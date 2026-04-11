import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ProtectionVerifyResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Pencil, Trash2, Upload, ShieldCheck, Search, FileWarning } from "lucide-react";

const AdminGallery = () => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [verifyUrl, setVerifyUrl] = useState("");
  const [verifyResult, setVerifyResult] = useState<ProtectionVerifyResponse | null>(null);
  const [reportSourceUrl, setReportSourceUrl] = useState("");
  const [reportNotes, setReportNotes] = useState("");

  const { data: images, isLoading } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: api.gallery.listAdmin,
  });
  const { data: protectionConfig } = useQuery({
    queryKey: ["protection-config"],
    queryFn: api.protection.getConfig,
  });
  const { data: protectionAssets } = useQuery({
    queryKey: ["protection-assets"],
    queryFn: api.protection.listAssets,
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
      queryClient.invalidateQueries({ queryKey: ["protection-assets"] });
      toast.success("Image(s) ajoutee(s)");
    } catch {
      toast.error("Erreur lors de l'upload");
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleVerifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await api.protection.verify({ dataUrl });
      setVerifyResult(result);
      toast.success(result.matched ? "Correspondance detectee" : "Aucune correspondance");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification impossible");
    }
    e.target.value = "";
  };

  const verifyByUrl = async () => {
    const value = verifyUrl.trim();
    if (!value) return;
    try {
      const result = await api.protection.verify({ image_url: value });
      setVerifyResult(result);
      toast.success(result.matched ? "Correspondance detectee" : "Aucune correspondance");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification impossible");
    }
  };

  const createReport = async () => {
    if (!reportSourceUrl.trim()) {
      toast.error("Renseignez l'URL source");
      return;
    }
    try {
      await api.protection.report({
        asset_id: verifyResult?.exact_matches?.[0]?.id || verifyResult?.near_matches?.[0]?.id,
        event_type: "infringement_report",
        source_url: reportSourceUrl.trim(),
        notes: reportNotes.trim(),
        evidence: {
          verify_candidate: verifyResult?.candidate || null,
          verify_exact_matches: verifyResult?.exact_matches?.length || 0,
          verify_near_matches: verifyResult?.near_matches?.length || 0,
        },
      });
      toast.success("Signalement enregistre");
      setReportNotes("");
      queryClient.invalidateQueries({ queryKey: ["protection-events"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signalement impossible");
    }
  };

  const copyDmcaTemplate = async () => {
    try {
      const dmca = await api.protection.getDmcaTemplate({
        asset_id: verifyResult?.exact_matches?.[0]?.id || verifyResult?.near_matches?.[0]?.id,
        source_url: reportSourceUrl.trim() || undefined,
      });
      await navigator.clipboard.writeText(dmca.template);
      toast.success("Template DMCA copie");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation DMCA impossible");
    }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.gallery.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      queryClient.invalidateQueries({ queryKey: ["protection-assets"] });
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 p-4 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <h3 className="font-display text-lg text-foreground">Protection de contenu</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Watermark: <strong>{protectionConfig?.enabled ? "actif" : "inactif"}</strong> | Anti-hotlink: <strong>{protectionConfig?.block_hotlink ? "actif" : "inactif"}</strong> | Assets proteges: <strong>{protectionAssets?.length || 0}</strong>
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="cursor-pointer rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
            <input type="file" accept="image/*" className="hidden" onChange={handleVerifyFile} />
            Verifier une image locale
          </label>
          <div className="flex gap-2">
            <Input value={verifyUrl} onChange={(e) => setVerifyUrl(e.target.value)} placeholder="https://site-externe/image.jpg" />
            <Button type="button" variant="outline" className="rounded-full gap-2" onClick={verifyByUrl}>
              <Search size={14} /> Verifier URL
            </Button>
          </div>
        </div>
        {verifyResult && (
          <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-2">
            <p>Resultat: <strong>{verifyResult.matched ? "match trouve" : "aucun match"}</strong></p>
            <p className="break-all">SHA256 candidat: {verifyResult.candidate.sha256 || "n/a"}</p>
            <p>Exact: {verifyResult.exact_matches.length} | Proche: {verifyResult.near_matches.length}</p>
            <div className="grid md:grid-cols-2 gap-2">
              <Input value={reportSourceUrl} onChange={(e) => setReportSourceUrl(e.target.value)} placeholder="URL de la copie non autorisee" />
              <Input value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} placeholder="Notes (optionnel)" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-full gap-2" onClick={createReport}>
                <FileWarning size={14} /> Signaler
              </Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={copyDmcaTemplate}>
                Copier template DMCA
              </Button>
            </div>
          </div>
        )}
      </section>

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
