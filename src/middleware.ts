import createMiddleware from 'next-intl/middleware';
import {NextRequest} from 'next/server';

const intlMiddleware = createMiddleware({
    // A list of all locales that are supported
    locales: ['en', 'bg'],

    // Used when no locale matches
    defaultLocale: 'bg',

    // Always include the locale prefix in the URL
    // This ensures the locale is visible and persists across navigation
    localePrefix: 'always'
});

export default function middleware(request: NextRequest) {
    // Check for user's locale preference in cookie
    const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
    const {pathname} = request.nextUrl;

    // If there's a locale cookie and the current path starts with a different locale, redirect
    if (localeCookie && ['en', 'bg'].includes(localeCookie)) {
        const pathLocale = pathname.split('/')[1];
        // If the path has a locale prefix that differs from the cookie
        if (pathLocale && ['en', 'bg'].includes(pathLocale) && pathLocale !== localeCookie) {
            const newPathname = pathname.replace(`/${pathLocale}`, `/${localeCookie}`);
            request.nextUrl.pathname = newPathname;
            return Response.redirect(request.nextUrl);
        }
    }

    return intlMiddleware(request);
}

export const config = {
    // Match only internationalized pathnames
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
