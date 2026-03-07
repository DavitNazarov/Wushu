import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  clubId: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organisationId: string): Promise<UserRow[]> {
    const users = await this.prisma.user.findMany({
      where: { organisationId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        clubId: true,
      },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      clubId: u.clubId,
    }));
  }
}
