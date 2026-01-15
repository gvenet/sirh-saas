import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async signup(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    const token = await this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      access_token: token,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const token = await this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      access_token: token,
    };
  }

  async validateUser(id: string): Promise<User | null> {
    return this.usersService.findById(id);
  }

  private async generateToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    if (!user) {
      // Pour des raisons de sécurité, on ne révèle pas si l'email existe
      return { message: 'Si cet email existe, un lien de réinitialisation a été envoyé' };
    }

    // Générer un token aléatoire
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Sauvegarder le token hashé et la date d'expiration (1 heure)
    await this.usersService.updateResetToken(
      user.id,
      hashedToken,
      new Date(Date.now() + 3600000), // 1 heure
    );

    // Envoyer l'email avec le token non-hashé
    try {
      await this.mailService.sendPasswordResetEmail(user.email, resetToken);
      return { message: 'Si cet email existe, un lien de réinitialisation a été envoyé' };
    } catch (error) {
      console.error('Failed to send email:', error.message);

      // En développement, on log le token pour pouvoir tester sans email
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔗 Reset token for ${user.email}: ${resetToken}`);
        console.log(`🔗 Reset URL: http://localhost:4200/reset-password?token=${resetToken}`);

        // En dev WSL2, on continue sans email car SMTP ne fonctionne pas
        // L'utilisateur peut copier l'URL ci-dessus pour tester
        return { message: 'Si cet email existe, un lien de réinitialisation a été envoyé' };
      }

      // En production, on ne révèle pas l'erreur pour des raisons de sécurité
      return { message: 'Si cet email existe, un lien de réinitialisation a été envoyé' };
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    // Hasher le token reçu pour le comparer
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetPasswordDto.token)
      .digest('hex');

    // Trouver l'utilisateur avec ce token et vérifier l'expiration
    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    // Mettre à jour le mot de passe et supprimer le token
    await this.usersService.updatePassword(
      user.id,
      resetPasswordDto.newPassword,
    );

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  private sanitizeUser(user: User) {
    const { password, resetPasswordToken, ...result } = user;
    return result;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    await this.usersService.updatePassword(userId, changePasswordDto.newPassword);

    return { message: 'Mot de passe modifié avec succès' };
  }
}
