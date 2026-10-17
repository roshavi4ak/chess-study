/* eslint-disable @typescript-eslint/no-require-imports -- Test-only Next Link boundary. */
const React = require('react');
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime');
const { formatUrl } = require('next/dist/shared/lib/router/utils/format-url');

// Keep next-intl's real localization and query handling. Replace only Next's
// bundled Link boundary, which requires the running app's webpack/RSC runtime.
module.exports = React.forwardRef(function TestNextLink({ href, prefetch, onClick, children, ...props }, ref) {
    const router = React.useContext(AppRouterContext);
    const url = typeof href === 'string' ? href : formatUrl(href);
    return React.createElement('a', {
        ...props, ref, href: url, 'data-prefetch': prefetch === false ? 'false' : 'auto',
        onClick(event) {
            onClick?.(event);
            if (!event.defaultPrevented) {
                event.preventDefault();
                router.push(url);
            }
        },
    }, children);
});
