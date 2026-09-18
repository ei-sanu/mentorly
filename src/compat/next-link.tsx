import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  to?: string;
  replace?: boolean;
  scroll?: boolean;
  children?: React.ReactNode;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, to, children, ...props }, ref) => {
    const destination = href || to || '#';
    const isExternal = destination.startsWith('http://') || 
                       destination.startsWith('https://') || 
                       destination.startsWith('mailto:') || 
                       destination.startsWith('tel:');

    if (isExternal) {
      return (
        <a ref={ref} href={destination} {...props}>
          {children}
        </a>
      );
    }

    return (
      <RouterLink ref={ref} to={destination} {...props}>
        {children}
      </RouterLink>
    );
  }
);

Link.displayName = 'Link';
export default Link;
