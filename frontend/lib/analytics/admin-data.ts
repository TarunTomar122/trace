import { cookies } from 'next/headers';
import { ADMIN_COOKIE,verifyAdminCookie } from './admin-auth';
export async function authorized(){return verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)}
