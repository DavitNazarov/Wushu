import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CapabilityGuard } from './capability.guard';
import { RequireCapability } from './capability.decorator';

@RequireCapability('CLASS_CAP')
class ClassProtectedController {
  list() {
    return true;
  }

  @RequireCapability('METHOD_CAP')
  update() {
    return true;
  }
}

class OpenController {
  list() {
    return true;
  }
}

function makeContext(input: {
  controller: object;
  handlerName: string;
  capabilities?: string[];
}): ExecutionContext {
  return {
    getClass: () => input.controller.constructor,
    getHandler: () =>
      (
        input.controller as Record<string, (...args: unknown[]) => unknown>
      )[input.handlerName],
    switchToHttp: () => ({
      getRequest: () => ({
        auth: input.capabilities
          ? { capabilities: input.capabilities }
          : undefined,
      }),
    }),
  } as ExecutionContext;
}

describe('CapabilityGuard', () => {
  it('allows routes with no capability metadata', () => {
    const guard = new CapabilityGuard(new Reflector());

    expect(
      guard.canActivate(
        makeContext({ controller: new OpenController(), handlerName: 'list' }),
      ),
    ).toBe(true);
  });

  it('enforces class-level capability metadata', () => {
    const guard = new CapabilityGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        makeContext({
          controller: new ClassProtectedController(),
          handlerName: 'list',
          capabilities: ['ATHLETES_MANAGE'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('prefers method-level capability metadata over class-level metadata', () => {
    const guard = new CapabilityGuard(new Reflector());

    expect(
      guard.canActivate(
        makeContext({
          controller: new ClassProtectedController(),
          handlerName: 'update',
          capabilities: ['METHOD_CAP'],
        }),
      ),
    ).toBe(true);
  });
});
