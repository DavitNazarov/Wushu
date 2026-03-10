import 'reflect-metadata';
import { REQUIRE_CAPABILITY } from './capability.guard';
import { CAPABILITIES } from './capabilities';
import { AuthController } from './auth.controller';
import { UsersController } from '../users/users.controller';

function getRequiredCapability(
  controller: object,
  methodName: string,
): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(controller),
    methodName,
  );
  return descriptor
    ? Reflect.getMetadata(REQUIRE_CAPABILITY, descriptor.value)
    : undefined;
}

describe('admin route capabilities', () => {
  const authController = Object.create(AuthController.prototype);
  const usersController = Object.create(UsersController.prototype);

  it('protects auth signup with admin-level capability', () => {
    expect(getRequiredCapability(authController, 'signup')).toBe(
      CAPABILITIES.EVENTS_MANAGE,
    );
  });

  it('protects admin user routes with admin-level capability', () => {
    for (const methodName of [
      'list',
      'create',
      'getOne',
      'update',
      'suspend',
      'removeSuspension',
      'archive',
    ]) {
      expect(getRequiredCapability(usersController, methodName)).toBe(
        CAPABILITIES.EVENTS_MANAGE,
      );
    }
  });
});
