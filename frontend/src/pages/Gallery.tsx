import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "@/components/AnimatedSection";
import galleryNails from "@/assets/gallery-nails.jpg";
import galleryMassage from "@/assets/gallery-massage.jpg";
import galleryProducts from "@/assets/gallery-products.jpg";
import galleryInterior from "@/assets/gallery-interior.jpg";

const fallbackImages = [
  { url: galleryNails, alt_text: "Manucure rose elegante" },
  { url: galleryMassage, alt_text: "Massage relaxant" },
  { url: galleryProducts, alt_text: "Produits de beauté" },
  { url: galleryInterior, alt_text: "Intérieur de l'institut" },
];

const Gallery = () => {
  const [selected, setSelected] = useState<number | null>(null);

  const { data: dbImages } = useQuery({
    queryKey: ["gallery"],
    queryFn: api.gallery.listPublic,
  });

  const images = dbImages && dbImages.length > 0
    ? dbImages.map((img, index) => ({ url: img.url, alt_text: img.alt_text || `Photo de galerie ${index + 1}` }))
    : fallbackImages;

  return (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow">
          <AnimatedSection>
            <div className="text-center mb-16">
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Nos réalisations</p>
              <h1 className="font-display text-4xl md:text-6xl text-foreground">
                <span className="italic text-gradient-rose">Galerie</span>
              </h1>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((img, i) => (
              <AnimatedSection key={i} delay={i * 0.08}>
                <div className="rounded-xl overflow-hidden border border-border/50 bg-card">
                  <div className="group relative cursor-pointer aspect-square" onClick={() => setSelected(i)}>
                    <img src={img.url} alt={img.alt_text} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors duration-300" />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-foreground">{img.alt_text}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selected !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setSelected(null)}>
            <button aria-label="Fermer l'image agrandie" className="absolute top-6 right-6 text-card hover:text-primary transition-colors" onClick={() => setSelected(null)}>
              <X size={32} />
            </button>
            <motion.img initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} src={images[selected].url} alt={images[selected].alt_text} className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default Gallery;
