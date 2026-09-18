import React from 'react';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
}

export const Image = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ src, alt, width, height, fill, priority, className, style, ...props }, ref) => {
    const imgStyle = fill
      ? {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover' as const,
          ...style,
        }
      : style;

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={className}
        style={imgStyle}
        {...props}
      />
    );
  }
);

Image.displayName = 'Image';
export default Image;
