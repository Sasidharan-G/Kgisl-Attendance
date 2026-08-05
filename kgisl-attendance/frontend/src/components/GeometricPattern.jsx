import React, { useState, useEffect, useMemo } from 'react';

const GeometricCell = ({ cell, images }) => {
  const [currentImgIdx, setCurrentImgIdx] = useState(
    Math.floor(Math.random() * images.length)
  );

  useEffect(() => {
    // Start with a random delay so they don't all change at once
    const delay = Math.random() * 3000;
    
    const timeout = setTimeout(() => {
      // Change image randomly every 3 to 6 seconds
      const interval = setInterval(() => {
        setCurrentImgIdx((prev) => {
          let next = Math.floor(Math.random() * images.length);
          // ensure it actually changes
          if (next === prev) next = (next + 1) % images.length;
          return next;
        });
      }, 3000 + Math.random() * 3000);
      
      return () => clearInterval(interval);
    }, delay);
    
    return () => clearTimeout(timeout);
  }, [images.length]);

  return (
    <div className="aspect-square p-1 relative">
      <div className={`w-full h-full ${cell.s} overflow-hidden relative shadow-sm`}>
        {/* Solid color fallback */}
        <div className={`absolute inset-0 ${cell.c}`}></div>
        
        {/* Render crossfading images with their original, natural colors */}
        {images.map((img, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 bg-cover bg-center transition-all duration-[2000ms] ease-in-out ${
              idx === currentImgIdx ? 'opacity-100 scale-100' : 'opacity-0 scale-110'
            }`}
            style={{ backgroundImage: `url(${img})` }}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default function GeometricPattern() {
  const images = useMemo(() => [
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80',
  ], []);

  const basePattern = [
    // Row 1
    { s: 'rounded-tl-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-b-full', c: 'bg-[#C4CBE1]' },
    { s: 'rounded-tr-full rounded-bl-full', c: 'border-2 border-[#484575] bg-[#302D68]' },
    { s: 'rounded-tl-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-tr-full', c: 'bg-[#A2C08A]' },

    // Row 2
    { s: 'rounded-l-full', c: 'bg-[#C4CBE1]' },
    { s: 'rounded-br-full', c: 'bg-[#0F5B9A]' },
    { s: 'rounded-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-bl-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-r-full', c: 'bg-[#A2C08A]' },

    // Row 3
    { s: 'rounded-tr-full rounded-bl-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-full', c: 'bg-[#0F5B9A]' },
    { s: 'rounded-t-full', c: 'bg-[#C4CBE1]' },
    { s: 'rounded-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-b-full', c: 'border-2 border-[#484575] bg-[#A2C08A]' },

    // Row 4
    { s: 'rounded-br-full', c: 'bg-[#C4CBE1]' },
    { s: 'rounded-full', c: 'bg-[#C4CBE1]' },
    { s: 'rounded-b-full', c: 'border-2 border-[#484575] bg-[#0F5B9A]' },
    { s: 'rounded-tl-full rounded-br-full', c: 'bg-[#E5F1EB]' },
    { s: 'rounded-tl-full', c: 'bg-[#0F5B9A]' },

    // Row 5
    { s: 'rounded-t-full', c: 'border-2 border-[#484575] bg-[#FBCF9E]' },
    { s: 'rounded-tr-full', c: 'bg-[#A2C08A]' },
    { s: 'rounded-bl-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-l-full', c: 'bg-[#C4CBE1]' },
    { s: 'rounded-br-full', c: 'bg-[#0F5B9A]' },

    // Row 6
    { s: 'rounded-full', c: 'bg-[#0F5B9A]' },
    { s: 'rounded-tl-full', c: 'bg-[#0F5B9A]' },
    { s: 'rounded-br-full', c: 'bg-[#C4CBE1]' },
    { s: 'rounded-bl-full', c: 'border-2 border-[#484575] bg-[#C4CBE1]' },
    { s: 'rounded-full', c: 'bg-[#E5F1EB]' },

    // Row 7
    { s: 'rounded-b-full', c: 'bg-[#A2C08A]' },
    { s: 'rounded-full', c: 'bg-[#E5F1EB]' },
    { s: 'rounded-tr-full rounded-bl-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-tr-full', c: 'bg-[#FBCF9E]' },
    { s: 'rounded-t-full', c: 'border-2 border-[#484575] bg-[#0F5B9A]' },
  ];

  // Multiply the base pattern to fill the screen
  const fullGrid = useMemo(() => [
    ...basePattern, ...basePattern, ...basePattern, 
    ...basePattern, ...basePattern, ...basePattern
  ], []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center pointer-events-none">
      <div className="w-full h-full min-w-[1200px] grid grid-cols-8 md:grid-cols-10 gap-1 p-2">
        {fullGrid.map((cell, i) => (
          <GeometricCell key={i} cell={cell} images={images} />
        ))}
      </div>
    </div>
  );
}
