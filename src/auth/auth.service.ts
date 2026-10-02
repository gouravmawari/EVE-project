import { Injectable } from '@nestjs/common';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { LoginDto, SignupDto } from '../common/dto';

@Injectable()
/** Handles password-backed account creation and JWT issuance. */
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}
  /** Creates a normalized, uniquely identified user with a hashed password. */
  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash: await hash(dto.password, 12) },
        select: { id: true, email: true, role: true },
      });
      return this.token(user);
    } catch (e: any) {
      if (e.code === 'P2002')
        throw new ConflictException('Email already registered');
      throw e;
    }
  }
  /** Compares a supplied password with the stored hash before issuing a token. */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !(await compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Invalid credentials');
    return this.token(user);
  }
  /** Builds the stable authentication response shared by signup and login. */
  private token(user: { id: string; email: string; role: any }) {
    return {
      accessToken: this.jwt.sign({ sub: user.id }),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
