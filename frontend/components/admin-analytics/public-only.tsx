'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
// Third-party trackers stay off the admin pages and the sponsors' private stats pages (/sponsor/<id>?k=<key>).
export function PublicOnly({children}:{children:ReactNode}){const path=usePathname();return path?.startsWith('/admin')||path?.startsWith('/sponsor/')?null:children}
