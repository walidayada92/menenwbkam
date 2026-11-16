export interface Taxon {
  id: string;
  nameAr: string;
  nameEn: string;
}
export interface Taxonomy {
  brands: Taxon[];
  categories: Taxon[];
}
export interface Product {
  id: string;
  modelName: string;
  brandId: string;
  categoryId: string;
  barcode: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  images: string[];
  brand: Taxon;
  category: Taxon;
  bestPrice: string;
  bestOfferId: string;
  offerCount: number;
}
export interface Listing {
  isFeatured: boolean;
  id: string;
  title: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  images: string[];
  price: string;
  stock: number;
  sku: string | null;
  productUrl: string | null;
  product: Product;
}
export interface Seller {
  workspaceRole?: string;
  features?: Record<string, boolean>;
  id: string;
  businessName: string;
  commercialRegNo: string | null;
  description: string | null;
  status: string;
  verificationName: string | null;
  rating: string;
  plan: { name: string; productLimit: number } | null;
  _count?: { offers: number };
  user?: { email: string };
}
export interface User {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  role: "SHOPPER" | "SELLER" | "ADMIN";
  isVerified?: boolean;
  createdAt?: string;
}
export interface SearchResults {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ProductDetail extends Product {
  offers: {
    isFeatured: boolean;
    id: string;
    title: string;
    descriptionAr: string | null;
    descriptionEn: string | null;
    images: string[];
    price: string;
    stock: number;
    productUrl: string | null;
    seller: {
      id: string;
      businessName: string;
      rating: string;
      slug?: string | null;
    };
  }[];
}
