import { Role } from '../users/enums/role.enum';
import { Permission } from './permissions.enum';

export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  [Role.ADMIN]: new Set(Object.values(Permission)),
  [Role.MANAGER]: new Set([
    Permission.USERS_VIEW,
    Permission.SHIFT_CREATE,
    Permission.SHIFT_ASSIGN,
    Permission.SHIFT_PUBLISH,
    Permission.SETTINGS_MANAGE,
    Permission.SWAP_REVIEW,
  ]),
  [Role.STAFF]: new Set([
    Permission.AVAILABILITY_MANAGE_SELF,
    Permission.SWAP_CREATE,
    Permission.SWAP_RESPOND,
    Permission.SWAP_CANCEL,
  ]),
};
