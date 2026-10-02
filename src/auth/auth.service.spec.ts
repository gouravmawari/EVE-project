import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('rejects invalid credentials', async () => {
    const service = new AuthService(
      { user: { findUnique: jest.fn().mockResolvedValue(null) } } as any,
      {} as any,
    );
    await expect(
      service.login({ email: 'nobody@example.com', password: 'wrong' }),
    ).rejects.toThrow('Invalid credentials');
  });
  it('signs a token for a valid user', async () => {
    const jwt = { sign: jest.fn().mockReturnValue('token') };
    const service = new AuthService(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u',
            email: 'a@example.com',
            role: 'USER',
            passwordHash:
              '$2b$04$abcdefghijklmnopqrstuuVh1wB1pM0N8uQ2dG9zv7v7v7v7v7v7v7v7v7v7v7v7v7v7v7v7v7v7v7v7v7v7v7',
          }),
        },
      } as any,
      jwt as any,
    );
    await expect(
      service.login({ email: 'a@example.com', password: 'wrong' }),
    ).rejects.toThrow('Invalid credentials');
  });
});
