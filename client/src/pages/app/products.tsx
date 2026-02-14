import { useEffect, useMemo, useState } from "react";
import { apiRequest, useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/plan";
import { downloadPriceListPdf, type PriceListExportPayload } from "@/lib/pdfs";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type ProductCategory = { id: number; name: string };
type ProductRow = {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  price: string;
  isActive: boolean;
  categoryId: number | null;
  stockTotal: number;
};

type ProductQuery = {
  q: string;
  categoryId: string;
  status: "all" | "active" | "inactive";
  minPrice: string;
  maxPrice: string;
  stock: "all" | "in" | "out" | "low";
  lowStockThreshold: string;
  sort: "name" | "price" | "stock" | "createdAt";
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

const DEFAULT_FILTERS: ProductQuery = {
  q: "",
  categoryId: "all",
  status: "all",
  minPrice: "",
  maxPrice: "",
  stock: "all",
  lowStockThreshold: "5",
  sort: "createdAt",
  dir: "desc",
  page: 1,
  pageSize: 20,
};

export default function ProductsPage() {
  const { hasFeature, loading: planLoading } = usePlan();
  const { user } = useAuth();
  const { toast } = useToast();
  const canAccess = hasFeature("products");

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [filters, setFilters] = useState<ProductQuery>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<ProductQuery>(DEFAULT_FILTERS);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20 });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const selectionKey = `orbia:products:selected:${user?.tenantId ?? "anon"}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(selectionKey);
      if (raw) {
        const ids = JSON.parse(raw) as number[];
        setSelectedIds(new Set(ids));
      }
    } catch {
      setSelectedIds(new Set());
    }
  }, [selectionKey]);

  useEffect(() => {
    localStorage.setItem(selectionKey, JSON.stringify(Array.from(selectedIds)));
  }, [selectedIds, selectionKey]);

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    void fetchCategories();
  }, [canAccess]);

  useEffect(() => {
    if (canAccess) {
      void fetchProducts(filters);
    }
  }, [filters, canAccess]);

  async function fetchCategories() {
    try {
      const res = await apiRequest("GET", "/api/product-categories");
      const data = await res.json();
      setCategories(data.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function buildQuery(current: ProductQuery) {
    const params = new URLSearchParams();
    if (current.q) params.set("q", current.q);
    if (current.categoryId !== "all") params.set("categoryId", current.categoryId);
    params.set("status", current.status);
    if (current.minPrice) params.set("minPrice", current.minPrice);
    if (current.maxPrice) params.set("maxPrice", current.maxPrice);
    params.set("stock", current.stock);
    params.set("lowStockThreshold", current.lowStockThreshold || "5");
    params.set("sort", current.sort);
    params.set("dir", current.dir);
    params.set("page", String(current.page));
    params.set("pageSize", String(current.pageSize));
    return params.toString();
  }

  async function fetchProducts(current: ProductQuery) {
    setLoading(true);
    try {
      const res = await apiRequest("GET", `/api/products?${buildQuery(current)}`);
      const json = await res.json();
      setRows(json.data || []);
      setMeta(json.meta || { total: 0, page: current.page, pageSize: current.pageSize });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function selectAllFiltered() {
    try {
      const res = await apiRequest("GET", `/api/products?${buildQuery({ ...filters, page: 1, pageSize: 100 })}`);
      const json = await res.json();
      const total = json.meta?.total || 0;
      let ids: number[] = (json.data || []).map((p: ProductRow) => p.id);
      const pages = Math.ceil(total / 100);
      for (let page = 2; page <= pages; page++) {
        const pageRes = await apiRequest("GET", `/api/products?${buildQuery({ ...filters, page, pageSize: 100 })}`);
        const pageJson = await pageRes.json();
        ids = ids.concat((pageJson.data || []).map((p: ProductRow) => p.id));
      }
      setSelectedIds(new Set(ids));
      toast({ title: "Selección actualizada", description: `Seleccionados: ${ids.length}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function toExportPayload(mode: "filtered" | "selected"): PriceListExportPayload {
    return {
      mode,
      filters: {
        q: filters.q || undefined,
        categoryId: filters.categoryId === "all" ? undefined : Number(filters.categoryId),
        status: filters.status,
        minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        stock: filters.stock,
        lowStockThreshold: Number(filters.lowStockThreshold || 5),
        sort: filters.sort,
        dir: filters.dir,
      },
      selectedIds: Array.from(selectedIds),
    };
  }

  async function handleDownload(mode: "filtered" | "selected") {
    try {
      await downloadPriceListPdf(toExportPayload(mode));
      toast({ title: "PDF generado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const pageSelected = useMemo(() => rows.every((row) => selectedIds.has(row.id)) && rows.length > 0, [rows, selectedIds]);

  if (planLoading) return <Skeleton className="h-64 w-full" />;

  if (!canAccess) {
    return <UpgradePrompt feature="products" title="Productos" description="Catálogo de productos y servicios" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Productos</h1>
        <p className="text-muted-foreground">Filtros server-side + exportación PDF profesional</p>
      </div>

      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Búsqueda</Label>
            <Input value={draft.q} onChange={(e) => setDraft((p) => ({ ...p, q: e.target.value }))} placeholder="Nombre, SKU o descripción" />
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={draft.categoryId} onValueChange={(v) => setDraft((p) => ({ ...p, categoryId: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={draft.status} onValueChange={(v: any) => setDraft((p) => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Precio mínimo</Label><Input type="number" value={draft.minPrice} onChange={(e) => setDraft((p) => ({ ...p, minPrice: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Precio máximo</Label><Input type="number" value={draft.maxPrice} onChange={(e) => setDraft((p) => ({ ...p, maxPrice: e.target.value }))} /></div>
          <div className="space-y-2">
            <Label>Stock</Label>
            <Select value={draft.stock} onValueChange={(v: any) => setDraft((p) => ({ ...p, stock: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="in">Con stock</SelectItem>
                <SelectItem value="out">Sin stock</SelectItem>
                <SelectItem value="low">Bajo stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Umbral bajo stock</Label><Input type="number" value={draft.lowStockThreshold} onChange={(e) => setDraft((p) => ({ ...p, lowStockThreshold: e.target.value }))} /></div>
          <div className="space-y-2">
            <Label>Orden</Label>
            <Select value={draft.sort} onValueChange={(v: any) => setDraft((p) => ({ ...p, sort: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Fecha creación</SelectItem>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="price">Precio</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dirección</Label>
            <Select value={draft.dir} onValueChange={(v: any) => setDraft((p) => ({ ...p, dir: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascendente</SelectItem>
                <SelectItem value="desc">Descendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <Button onClick={() => setFilters({ ...draft, page: 1 })}>Aplicar</Button>
            <Button variant="outline" onClick={() => { setDraft(DEFAULT_FILTERS); setFilters(DEFAULT_FILTERS); }}>Limpiar</Button>
            <Button variant="outline" onClick={() => setSelectedIds(new Set())}>Limpiar selección</Button>
            <Button variant="outline" onClick={selectAllFiltered}>Seleccionar todo (filtrado)</Button>
            <Button variant="outline" onClick={() => handleDownload("filtered")}>PDF con filtrados</Button>
            <Button variant="outline" disabled={selectedIds.size === 0} onClick={() => handleDownload("selected")}>PDF con seleccionados</Button>
            <Badge variant="secondary">Seleccionados: {selectedIds.size}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Checkbox checked={pageSelected} onCheckedChange={(checked) => {
              const next = new Set(selectedIds);
              if (checked) rows.forEach((r) => next.add(r.id)); else rows.forEach((r) => next.delete(r.id));
              setSelectedIds(next);
            }} />
            <span className="text-sm text-muted-foreground">Seleccionar página</span>
          </div>

          {loading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <div className="space-y-2">
              {rows.map((p) => (
                <div key={p.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(p.id); else next.delete(p.id);
                      setSelectedIds(next);
                    }} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-sm text-muted-foreground truncate">SKU: {p.sku || "-"} · Stock total: {p.stockTotal}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${Number(p.price).toLocaleString("es-AR")}</p>
                    <Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Activo" : "Inactivo"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total: {meta.total}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={filters.page <= 1} onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}>Anterior</Button>
              <span className="text-sm">Página {filters.page}</span>
              <Button variant="outline" disabled={filters.page * filters.pageSize >= meta.total} onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}>Siguiente</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
