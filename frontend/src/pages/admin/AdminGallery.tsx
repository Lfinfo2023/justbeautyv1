import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Pencil, Trash2, Upload } from "lucide-react";

const AdminGallery = () => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  const { data: images, isLoading } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: api.gallery.listAdmin,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        await api.gallery.upload({
          filename: file.name,
          dataUrl,
          alt_text: file.name.replace(/\.[^.]+$/, ""),
          sort_order: images?.length ?? 0,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("Image(s) ajoutee(s)");
    } catch {
      toast.error("Erreur lors de l'upload");
    }
    setUploading(false);
    e.target.value = "";
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.gallery.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("Image supprimee");
    },
  });

  const rename = useMutation({
    mutationFn: async ({ id, alt_text }: { id: string; alt_text: string }) => api.gallery.update(id, { alt_text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("Nom de l'image mis a jour");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible de renommer l'image");
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-foreground">Galerie</h3>
        <label className="cursor-pointer">
          <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
          <Button asChild className="bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full gap-2 font-body" disabled={uploading}>
            <span><Upload size={16} /> {uploading ? "Upload..." : "Ajouter des images"}</span>
          </Button>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images?.map((img) => (
          <div key={img.id} className="rounded-xl overflow-hidden border border-border/50 bg-card">
            <div className="relative group aspect-square">
              <img src={img.url} alt={img.alt_text || ""} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center">
                <Button
                  size="sm"
                  variant="destructive"
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                  onClick={() => remove.mutate(img.id)}
                >
                  <Trash2 size={14} className="mr-1" /> Supprimer
                </Button>
              </div>
            </div>
            <div className="p-3 space-y-2">
              <Input
                value={draftNames[img.id] ?? img.alt_text ?? ""}
                onChange={(e) => setDraftNames((current) => ({ ...current, [img.id]: e.target.value }))}
                placeholder="Nom de l'image"
                className="rounded-lg bg-muted/50"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-full gap-2"
                onClick={() => rename.mutate({ id: img.id, alt_text: (draftNames[img.id] ?? img.alt_text ?? "").trim() })}
                disabled={rename.isPending}
              >
                <Pencil size={14} /> Enregistrer le nom
              </Button>
            </div>
          </div>
        ))}
        {(!images || images.length === 0) && (
          <p className="col-span-full text-center text-muted-foreground py-12">Aucune image. Ajoutez-en !</p>
        )}
      </div>
    </div>
  );
};

export default AdminGallery;
