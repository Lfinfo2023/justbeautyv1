import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Service } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const categories = ["Massage", "Soins du visage", "Épilation", "Maquillage", "Pédicure", "Manucure"];
const emptyService = { name: "", category: "Massage", description: "", price: 0, price_label: "", duration_minutes: 90, sort_order: 0, is_active: true };

const AdminServices = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyService);

  const { data: services, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: api.services.listAdmin,
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) {
        await api.services.update(editing, form);
      } else {
        await api.services.create({ ...form, sort_order: services?.length ?? 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success(editing ? "Service modifie" : "Service ajoute");
      setOpen(false);
      setEditing(null);
      setForm(emptyService);
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.services.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service supprime");
    },
  });

  const openEdit = (service: Service) => {
    setEditing(service.id);
    setForm({
      name: service.name,
      category: service.category,
      description: service.description || "",
      price: service.price,
      price_label: service.price_label || "",
      duration_minutes: service.duration_minutes,
      sort_order: service.sort_order,
      is_active: service.is_active,
    });
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyService);
    setOpen(true);
  };

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-foreground">Gestion des services</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full gap-2 font-body">
              <Plus size={16} /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Modifier le service" : "Nouveau service"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
              <Input placeholder="Nom du service" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="rounded-lg bg-muted/50" />
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger className="rounded-lg bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Description (optionnel)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg bg-muted/50" />
              <Input placeholder="Prix affiche (ex: A partir de 50 EUR)" value={form.price_label} onChange={(e) => setForm({ ...form, price_label: e.target.value })} className="rounded-lg bg-muted/50" />
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" placeholder="Prix (EUR)" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required className="rounded-lg bg-muted/50" />
                <Input type="number" placeholder="Duree (min)" value={form.duration_minutes || ""} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} required className="rounded-lg bg-muted/50" />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full font-body">
                {editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Durée</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services?.map((service) => (
              <TableRow key={service.id}>
                <TableCell className="font-medium text-foreground">{service.name}</TableCell>
                <TableCell className="text-sm">{service.category}</TableCell>
                <TableCell className="text-sm">{service.duration_minutes} min</TableCell>
                <TableCell className="text-sm font-medium">{service.price_label || `${service.price} EUR`}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(service)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => remove.mutate(service.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminServices;
