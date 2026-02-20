export interface IAuthStorage {}

class AuthStorage implements IAuthStorage {}

export const authStorage = new AuthStorage();
