/**
 * Утилиты для работы с аутентификацией
 */
import { api } from './api';

export interface User {
  id: number;
  email: string;
  full_name: string;
  user_type: 'supplier' | 'customer' | 'admin';
  is_active: boolean;
  description?: string | null;
  contact_phone?: string | null;
  integration_type?: string | null;
  integration_config?: any;
  logo_url?: string | null;
  delivery_address?: string | null;
}

export class AuthService {
  private static instance: AuthService;
  private user: User | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-session-expired', () => {
        this.logout();
      });
      this.loadUser();
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private notifyAuthChanged() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth-state-changed'));
    }
  }

  private async loadUser() {
    try {
      const token = localStorage.getItem('auth_token')?.trim();
      if (token) {
        api.setToken(token);
        try {
          this.user = await api.getCurrentUser();
          this.notifyAuthChanged();
        } catch (error) {
          // Токен невалиден
          this.logout();
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      this.logout();
    }
  }

  async login(email: string, password: string): Promise<User> {
    await api.login(email, password);
    this.user = await api.getCurrentUser();
    this.notifyAuthChanged();
    return this.user;
  }

  async register(userData: {
    email: string;
    password: string;
    full_name: string;
    user_type: string;
  }): Promise<User> {
    await api.register(userData);
    // После регистрации автоматически входим
    return this.login(userData.email, userData.password);
  }

  logout() {
    api.logout();
    this.user = null;
    this.notifyAuthChanged();
  }

  getUser(): User | null {
    return this.user;
  }
  
  async refreshUser(): Promise<User | null> {
    try {
      const token = localStorage.getItem('auth_token')?.trim();
      if (token) {
        api.setToken(token);
        this.user = await api.getCurrentUser();
        this.notifyAuthChanged();
        return this.user;
      }
    } catch {
      this.logout();
    }
    return null;
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }

  getUserType(): string | null {
    return this.user?.user_type || null;
  }

  setUser(user: User) {
    this.user = user;
    this.notifyAuthChanged();
  }
}

export const authService = AuthService.getInstance();

