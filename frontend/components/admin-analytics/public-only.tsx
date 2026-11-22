'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
export function PublicOnly({children}:{children:ReactNode}){return usePathname()?.startsWith('/admin')?null:children}
