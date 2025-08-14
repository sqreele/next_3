'use client';
import Image from 'next/image';
import React, { useMemo } from 'react';

interface LazyImageProps {
	src: string | null | undefined;
	alt: string;
	className?: string;
	onError?: () => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, onError }) => {
	const safeSrc = useMemo(() => (typeof src === 'string' && src.length > 0 ? src : ''), [src]);
	const isOwnDomain = safeSrc.includes('pcms.live');

	return (
		<Image
			src={safeSrc}
			alt={alt}
			className={className}
			width={0}
			height={0}
			sizes="100vw"
			style={{ width: '100%', height: 'auto' }}
			loading="lazy"
			unoptimized={isOwnDomain}
			onError={() => {
				console.error(`Failed to load image: ${safeSrc}`);
				onError?.();
			}}
		/>
	);
};
