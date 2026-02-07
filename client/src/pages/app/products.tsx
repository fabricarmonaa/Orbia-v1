import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/auth";
import { usePlan } from "@/lib/plan";
import { VoiceCommand } from "@/components/voice-command";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Package, Tag, Mic, Download, Pencil, Power } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product, ProductCategory } from "@shared/schema";

export default function ProductsPage() {
  const { hasFeature, loading: planLoading } = usePlan();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [productDialog, setProductDialog] = useState(false);
  const [catDialog, setCatDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const { toast } = useToast();

  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: "",
    sku: "",
    categoryId: "",
    cost: "",
    stock: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    price: "",
    sku: "",
    categoryId: "",
    cost: "",
    stock: "",
  });
  const [newCat, setNewCat] = useState("");

  const canAccess = hasFeature("products");

  useEffect(() => {
    if (canAccess) fetchData();
    else setLoading(false);
  }, [canAccess]);

  async function fetchData() {
    try {
      const [productsRes, catsRes] = await Promise.all([
        apiRequest("GET", "/api/products"),
        apiRequest("GET", "/api/product-categories"),
      ]);
      const productsData = await productsRes.json();
      const catsData = await catsRes.json();
      setProducts(productsData.data || []);
      setCategories(catsData.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest("POST", "/api/products", {
        ...newProduct,
        price: parseFloat(newProduct.price),
        categoryId: newProduct.categoryId ? parseInt(newProduct.categoryId) : null,
        cost: newProduct.cost ? parseFloat(newProduct.cost) : null,
        stock: newProduct.stock ? parseInt(newProduct.stock) : null,
      });
      toast({ title: "Producto creado" });
      setProductDialog(false);
      setNewProduct({ name: "", description: "", price: "", sku: "", categoryId: "", cost: "", stock: "" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      sku: product.sku || "",
      categoryId: product.categoryId ? String(product.categoryId) : "",
      cost: product.cost ?? "",
      stock: product.stock != null ? String(product.stock) : "",
    });
    setEditDialog(true);
  }

  async function updateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await apiRequest("PATCH", `/api/products/${editingProduct.id}`, {
        name: editForm.name,
        description: editForm.description,
        price: parseFloat(editForm.price),
        sku: editForm.sku,
        categoryId: editForm.categoryId ? parseInt(editForm.categoryId) : null,
        cost: editForm.cost ? parseFloat(editForm.cost) : null,
        stock: editForm.stock ? parseInt(editForm.stock) : null,
      });
      toast({ title: "Producto actualizado" });
      setEditDialog(false);
      setEditingProduct(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function toggleActive(product: Product) {
    try {
      await apiRequest("PATCH", `/api/products/${product.id}/toggle`);
      toast({ title: product.isActive ? "Producto desactivado" : "Producto activado" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function exportCSV() {
    try {
      const res = await apiRequest("GET", "/api/products/export/csv");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "productos.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV descargado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function handleVoiceConfirm(intent: any) {
    setNewProduct({
      name: intent.name || "",
      description: intent.description || "",
      price: intent.price ? String(intent.price) : "",
      sku: intent.sku || "",
      categoryId: "",
      cost: intent.cost ? String(intent.cost) : "",
      stock: intent.stock ? String(intent.stock) : "",
    });
    setShowVoice(false);
    setProductDialog(true);
    toast({ title: "Datos cargados por voz" });
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest("POST", "/api/product-categories", { name: newCat });
      toast({ title: "Categoría creada" });
      setCatDialog(false);
      setNewCat("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  if (planLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <UpgradePrompt
        feature="products"
        title="Productos"
        description="Catálogo de productos y servicios"
      />
    );
  }

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || String(p.categoryId) === filterCat;
    return matchSearch && matchCat;
  });

  function getCatName(catId: number | null) {
    if (!catId) return "Sin categoría";
    return categories.find((c) => c.id === catId)?.name || "Sin categoría";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-muted-foreground">Catálogo de productos y servicios</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasFeature("stt") && !showVoice && (
            <Button variant="outline" onClick={() => setShowVoice(true)} data-testid="button-voice-product">
              <Mic className="w-4 h-4 mr-2" />
              Dictar
            </Button>
          )}
          <Button variant="outline" onClick={exportCSV} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Dialog open={catDialog} onOpenChange={setCatDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create-category">
                <Tag className="w-4 h-4 mr-2" />
                Categoría
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Categoría</DialogTitle>
              </DialogHeader>
              <form onSubmit={createCategory} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    placeholder="Nombre de la categoría"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    required
                    data-testid="input-category-name"
                  />
                </div>
                <Button type="submit" className="w-full" data-testid="button-submit-category">
                  Crear Categoría
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={productDialog} onOpenChange={setProductDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-product">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Producto</DialogTitle>
              </DialogHeader>
              <form onSubmit={createProduct} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    placeholder="Nombre del producto"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    required
                    data-testid="input-product-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      required
                      data-testid="input-product-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      placeholder="Código"
                      value={newProduct.sku}
                      onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                      data-testid="input-product-sku"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={newProduct.categoryId}
                    onValueChange={(v) => setNewProduct({ ...newProduct, categoryId: v })}
                  >
                    <SelectTrigger data-testid="select-product-category">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Costo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newProduct.cost}
                      onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })}
                      data-testid="input-product-cost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="0"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                      data-testid="input-product-stock"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    placeholder="Descripción del producto"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    data-testid="input-product-description"
                  />
                </div>
                <Button type="submit" className="w-full" data-testid="button-submit-product">
                  Crear Producto
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {showVoice && (
        <VoiceCommand
          context="products"
          onConfirm={handleVoiceConfirm}
          onCancel={() => setShowVoice(false)}
        />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-products"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-40" data-testid="select-filter-category">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-md" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No hay productos</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Probá con otra búsqueda" : "Creá tu primer producto"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={`hover-elevate ${!product.isActive ? "opacity-60" : ""}`}
              data-testid={`card-product-${product.id}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{product.name}</p>
                      {!product.isActive && <Badge variant="outline">Inactivo</Badge>}
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Badge variant="secondary">{getCatName(product.categoryId)}</Badge>
                      {product.sku && (
                        <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>
                      )}
                      {product.stock != null && (
                        <span className="text-xs text-muted-foreground">Stock: {product.stock}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-lg font-bold">${parseFloat(product.price).toLocaleString("es-AR")}</p>
                    {product.cost && (
                      <p className="text-xs text-muted-foreground">
                        Costo: ${parseFloat(product.cost).toLocaleString("es-AR")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(product)}
                    data-testid={`button-edit-product-${product.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleActive(product)}
                    data-testid={`button-toggle-product-${product.id}`}
                  >
                    <Power className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateProduct} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                placeholder="Nombre del producto"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                data-testid="input-edit-product-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  required
                  data-testid="input-edit-product-price"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  placeholder="Código"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  data-testid="input-edit-product-sku"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={editForm.categoryId}
                onValueChange={(v) => setEditForm({ ...editForm, categoryId: v })}
              >
                <SelectTrigger data-testid="select-edit-product-category">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Costo</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editForm.cost}
                  onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                  data-testid="input-edit-product-cost"
                />
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={editForm.stock}
                  onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                  data-testid="input-edit-product-stock"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Descripción del producto"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                data-testid="input-edit-product-description"
              />
            </div>
            <Button type="submit" className="w-full" data-testid="button-submit-edit-product">
              Guardar Cambios
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
