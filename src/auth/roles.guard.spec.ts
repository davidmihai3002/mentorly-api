import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/internal';
import { USER_ROLE, type UserRole } from '../users/index.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class MentorAreaController {
  @Roles([USER_ROLE.MENTOR])
  mentorRoute(this: void): void {}

  routeWithoutRoles(this: void): void {}
}

const { mentorRoute, routeWithoutRoles } = MentorAreaController.prototype;

describe('RolesGuard', () => {
  const rolesGuard = new RolesGuard(new Reflector());

  const activateFor = (role: UserRole, route: () => void): boolean => {
    const context = new ExecutionContextHost(
      [{ user: { id: '6f1c2a4e-8b3d-4f5a-9c7e-1d2b3a4c5e6f', role } }],
      MentorAreaController,
      route,
    );
    return rolesGuard.canActivate(context);
  };

  it('allows a user whose role is listed in @Roles', () => {
    expect(activateFor(USER_ROLE.MENTOR, mentorRoute)).toBe(true);
  });

  it('rejects a user whose role is not listed in @Roles with 403', () => {
    expect(() => activateFor(USER_ROLE.MENTEE, mentorRoute)).toThrow(
      ForbiddenException,
    );
  });

  it('rejects every user with 403 on a route without @Roles', () => {
    expect(() => activateFor(USER_ROLE.MENTOR, routeWithoutRoles)).toThrow(
      ForbiddenException,
    );
  });
});
