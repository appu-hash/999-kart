
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Product information stored in the cart
export interface CartProduct {
  id: string;
  name: string;
  selling_price: number;
  image_url: string | null;
}

// Cart item includes quantity
export interface CartItem extends CartProduct {
  quantity: number;
}

// Cart context methods and values
interface CartContextType {
  items: CartItem[];
  addToCart: (product: CartProduct) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  subtotal: number;
}

const CART_STORAGE_KEY = "999kart-cart";

const CartContext = createContext<CartContextType | undefined>(
  undefined
);

// Validate cart data loaded from localStorage
function validateCart(savedItems: unknown): CartItem[] {
  if (!Array.isArray(savedItems)) {
    return [];
  }

  return savedItems.filter((item): item is CartItem => {
    return (
      item !== null &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.selling_price === "number" &&
      Number.isFinite(item.selling_price) &&
      item.selling_price >= 0 &&
      (typeof item.image_url === "string" ||
        item.image_url === null) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
    );
  });
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Load cart from localStorage
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);

      if (!saved) {
        return [];
      }

      return validateCart(JSON.parse(saved));
    } catch (error) {
      console.error("Could not load cart:", error);
      return [];
    }
  });

  // Save cart whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(items)
      );
    } catch (error) {
      console.error("Could not save cart:", error);
    }
  }, [items]);

  // Add product to cart
  function addToCart(product: CartProduct) {
    if (
      !product.id ||
      !product.name ||
      !Number.isFinite(product.selling_price) ||
      product.selling_price < 0
    ) {
      return;
    }

    setItems((current) => {
      const existing = current.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
        },
      ];
    });
  }

  // Remove product from cart
  function removeFromCart(id: string) {
    setItems((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  // Update product quantity
  function updateQuantity(
    id: string,
    quantity: number
  ) {
    const validQuantity = Math.floor(quantity);

    if (!Number.isFinite(quantity) || validQuantity <= 0) {
      removeFromCart(id);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: validQuantity,
            }
          : item
      )
    );
  }

  // Clear cart after successful order placement
  function clearCart() {
    setItems([]);
  }

  // Total number of products
  const cartCount = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  // Display subtotal
  // IMPORTANT: Checkout must recalculate prices from Supabase.
  const subtotal = items.reduce(
    (total, item) =>
      total + item.selling_price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// Custom cart hook
export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider"
    );
  }

  return context;
}
