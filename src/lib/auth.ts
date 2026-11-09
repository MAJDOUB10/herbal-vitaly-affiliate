// Authentication and session management for the affiliate platform
import { type User, Role, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: string; // 'affiliate' or 'admin' from the form
  invitationToken?: string;
}

class AuthService {
  private readonly TOKEN_EXPIRY_HOURS = 24;

  private generateReferralCode(name: string): string {
    const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
    return `${cleanName.substr(0, 6)}-${random}`;
  }

  /**
   * Register a new user and create their profile.
   * This is a server-side only method.
   */
  async register(data: RegisterData): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const email = data.email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return { success: false, message: 'An account with this email already exists. Sign in or request another code.' };
      const hashedPassword = await bcrypt.hash(data.password, 12);
      const user = await prisma.$transaction(async tx => {
        let invite: { masterAffiliateId: string; shareBps: number } | null = null;
        if (data.invitationToken) {
          const tokenHash = crypto.createHash('sha256').update(data.invitationToken).digest('hex');
          const record = await tx.teamInvitation.findUnique({
            where: { tokenHash }, include: { master: { include: { user: true } } },
          });
          if (!record || record.email !== email || record.usedAt ||
              record.expiresAt <= new Date() || !record.master.isMasterPartner ||
              record.master.parentAffiliateId || record.master.user.role !== 'AFFILIATE' ||
              record.master.user.status !== 'ACTIVE' || !record.master.user.emailVerifiedAt ||
              !Number.isInteger(record.shareBps) || record.shareBps < 0 || record.shareBps > 10000) {
            throw new Error('INVALID_TEAM_INVITATION');
          }
          const claimed = await tx.teamInvitation.updateMany({
            where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
            data: { usedAt: new Date() },
          });
          if (claimed.count !== 1) throw new Error('INVITATION_ALREADY_USED');
          invite = { masterAffiliateId: record.masterAffiliateId, shareBps: record.shareBps };
        }
        const created = await tx.user.create({
          data: { email, name: data.name.trim(), password: hashedPassword, role: 'AFFILIATE', status: 'PENDING' },
        });
        await tx.affiliate.create({
          data: { userId: created.id, referralCode: this.generateReferralCode(data.name), payoutDetails: {}, balanceCents: 0,
            parentAffiliateId: invite?.masterAffiliateId || null, teamShareBps: invite?.shareBps ?? null },
        });
        return created;
      });

      return {
        success: true,
        message: 'Registration successful',
        user: user
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed' };
    }
  }

  /**
   * Update a user's password.
   * Server-side only.
   */
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return { success: false, message: 'Current password is incorrect' };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      console.error('Update password error:', error);
      return { success: false, message: 'Password update failed' };
    }
  }
}

export const auth = new AuthService();