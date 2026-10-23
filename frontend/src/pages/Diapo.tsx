import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const DISPLAY_DURATION_MS = 8000;

const Diapo = () => {
  const { data: images = [], isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: api.gallery.listPublic,
    refetchInterval: 60_000,
  });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % images.length), DISPLAY_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [images.length]);

  useEffect(() => {
    if (activeIndex >= images.length) setActiveIndex(0);
  }, [activeIndex, images.length]);

  if (isLoading) return <main className="h-screen w-screen bg-black" />;
  if (!images.length) return <main className="h-screen w-screen bg-black flex items-center justify-center text-white text-xl">Aucune image dans la galerie.</main>;

  return (
    <main className="fixed inset-0 overflow-hidden bg-black select-none" aria-label="Diaporama Just Beauty">
      {images.map((image, index) => (
        <img
          key={image.id}
          src={image.url}
          alt={index === activeIndex ? image.alt_text || "Just Beauty" : ""}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1800ms] ease-in-out ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
          draggable={false}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-8 left-10 text-white/90">
        <p className="font-display text-4xl tracking-wide">Just Beauty</p>
        <p className="mt-1 text-sm tracking-[0.28em] uppercase text-white/75">Votre moment beauté</p>
      </div>
    </main>
  );
};

export default Diapo;
