import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  MapPin,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCart } from "./CartContext";
import "./CartPage.css";

type SavedAddress = {
  id: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  locality: string;
  city: string;
  district: string | null;
  state: string;
  postal_code: string;
  delivery_instructions?: string | null;
  is_default: boolean;
};

type PlacedOrder = {
  id?: string;
  order_code?: string;
  grand_total?: number;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

export default function CartPage() {
  const navigate = useNavigate();
  const {
    items,
    removeFromCart,
    updateQuantity,
    subtotal,
    clearCart,
  } = useCart();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<typeof items>([]);
  const [confirmedSubtotal, setConfirmedSubtotal] = useState(0);

  const cartIsEmpty = items.length === 0;

  const cartCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items]
  );

  useEffect(() => {
    if (!checkoutOpen) return;

    let isActive = true;

    async function loadAddresses() {
      setLoadingAddresses(true);
      setMessage("");
      setMessageIsError(false);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (!isActive) return;

      if (authError || !authData.user) {
        setLoadingAddresses(false);
        navigate("/account", {
          state: { message: "Please sign in before checkout." },
        });
        return;
      }

      const { data, error } = await supabase
        .from("addresses")
        .select(
          "id, recipient_name, phone, address_line1, address_line2, landmark, locality, city, district, state, postal_code, delivery_instructions, is_default"
        )
        .eq("user_id", authData.user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (!isActive) return;

      if (error) {
        setMessage(error.message);
        setMessageIsError(true);
        setAddresses([]);
      } else {
        const savedAddresses = (data ?? []) as SavedAddress[];
        setAddresses(savedAddresses);

        const defaultAddress = savedAddresses.find(
          (address) => address.is_default
        );

        setSelectedAddressId(
          defaultAddress?.id ?? savedAddresses[0]?.id ?? ""
        );
      }

      setLoadingAddresses(false);
    }

    void loadAddresses();

    return () => {
      isActive = false;
    };
  }, [checkoutOpen, navigate]);

  function openCheckout() {
    if (cartIsEmpty) return;
    setCheckoutOpen(true);
    setMessage("");
    setMessageIsError(false);
  }

  function closeCheckout() {
    if (placingOrder) return;
    setCheckoutOpen(false);
    setMessage("");
  }

  async function handlePlaceOrder() {
    if (!selectedAddressId) {
      setMessage("Please select a delivery address.");
      setMessageIsError(true);
      return;
    }

    if (items.length === 0) {
      setMessage("Your cart is empty.");
      setMessageIsError(true);
      return;
    }

    setPlacingOrder(true);
    setMessage("");
    setMessageIsError(false);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        navigate("/account", {
          state: { message: "Please sign in before placing your order." },
        });
        return;
      }

      // Prices are deliberately not sent. The server must retrieve
      // current prices from the products table and calculate totals.
      const { data, error } = await supabase.functions.invoke(
        "place-cod-order",
        {
          body: {
            address_id: selectedAddressId,
            items: items.map((item) => ({
              product_id: item.id,
              quantity: item.quantity,
            })),
            customer_note: customerNote.trim() || null,
          },
        }
      );

      if (error) {
        let detail = error.message;

        try {
          const response = error.context as Response | undefined;
          if (response && typeof response.json === "function") {
            const body = await response.json();
            detail = body?.error || body?.message || detail;
          }
        } catch {
          // Keep the original function error message.
        }

        throw new Error(detail);
      }

      if (!data || data.error) {
        throw new Error(data?.error || "The order could not be placed.");
      }

      const order: PlacedOrder = data.order ?? data;
      if (!order.order_code && !order.id) {
        throw new Error(
          "The server response did not include an order reference. Please contact support before retrying."
        );
      }

      setConfirmedItems(items.map((item) => ({ ...item })));
      setConfirmedSubtotal(subtotal);
      setPlacedOrder(order);
      clearCart();
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while placing your order."
      );
      setMessageIsError(true);
    } finally {
      setPlacingOrder(false);
    }
  }

  const selectedAddress = addresses.find(
    (address) => address.id === selectedAddressId
  );

  return (
    <div className="cart-page">
      <header className="cart-header">
        <Link to="/" className="cart-logo">
          999<span>+</span> KART
        </Link>

        {checkoutOpen ? (
          <button
            type="button"
            className="cart-back-link cart-header-button"
            onClick={closeCheckout}
            disabled={placingOrder}
          >
            <ArrowLeft size={15} /> Back to cart
          </button>
        ) : (
          <Link to="/" className="cart-back-link">
            Continue shopping
          </Link>
        )}
      </header>

      <main className="cart-container">
        {placedOrder ? (
          <section className="checkout-confirmation">
            <div className="checkout-confirmation-icon">
              <CheckCircle2 size={34} />
            </div>
            <p className="cart-heading-eyebrow">ORDER CONFIRMED</p>
            <h1>Thank you for your order!</h1>
            <p>
              Your Cash on Delivery order has been submitted successfully.
              Keep your order reference for future updates.
            </p>

            <div className="checkout-confirmation-reference">
              <span>ORDER REFERENCE</span>
              <strong>{placedOrder.order_code ?? placedOrder.id}</strong>
            </div>

            <div className="checkout-receipt">
              <div className="checkout-receipt-heading">
                <strong>ORDER BILL</strong>
                <span>Server-confirmed order summary</span>
              </div>
              {confirmedItems.map((item) => (
                <div className="checkout-receipt-row" key={item.id}>
                  <span>
                    {item.name}
                    <small>{formatPrice(item.selling_price)} × {item.quantity}</small>
                  </span>
                  <strong>{formatPrice(item.selling_price * item.quantity)}</strong>
                </div>
              ))}
              <div className="checkout-receipt-row">
                <span>Cart item subtotal</span>
                <strong>{formatPrice(confirmedSubtotal)}</strong>
              </div>
              {typeof placedOrder.grand_total === "number" && (
                <>
                  <div className="checkout-receipt-row checkout-receipt-muted">
                    <span>Delivery, taxes or adjustments</span>
                    <span>Included in final total</span>
                  </div>
                  <div className="checkout-receipt-total">
                    <span>Final amount to pay (COD)</span>
                    <strong>{formatPrice(placedOrder.grand_total)}</strong>
                  </div>
                </>
              )}
              <p className="checkout-receipt-note">
                Item prices above are the cart snapshot. The final amount is returned by the server after its price and charge calculations.
              </p>
            </div>

            <div className="checkout-confirmation-actions">
              <Link to="/account/dashboard" className="cart-shop-button">
                VIEW MY ORDERS
              </Link>
              <Link to="/" className="checkout-continue-link">
                Continue shopping <ArrowRight size={15} />
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="cart-heading">
              <p>{checkoutOpen ? "SECURE CHECKOUT" : "YOUR SELECTION"}</p>
              <h1>{checkoutOpen ? "Complete your order" : "Shopping cart"}</h1>
              <span>
                {checkoutOpen
                  ? "Confirm your delivery details and payment method."
                  : `${cartCount} item${cartCount === 1 ? "" : "s"} in your cart`}
              </span>
            </div>

            {message && (
              <div
                className={`checkout-message ${messageIsError ? "checkout-error" : ""}`}
                role="alert"
              >
                {message}
              </div>
            )}

            {cartIsEmpty ? (
              <div className="cart-empty">
                <div className="cart-empty-icon">
                  <ShoppingBag size={42} />
                </div>
                <h2>Your cart is empty</h2>
                <p>Looks like you haven't added anything yet.</p>
                <Link to="/" className="cart-shop-button">
                  EXPLORE PRODUCTS
                </Link>
              </div>
            ) : checkoutOpen ? (
              <div className="checkout-layout">
                <div className="checkout-main">
                  <section className="checkout-card">
                    <div className="checkout-card-heading">
                      <div>
                        <h2>
                          <MapPin size={19} /> Delivery address
                        </h2>
                        <p>Choose where you want your order delivered.</p>
                      </div>
                      <Link
                        to="/account/dashboard"
                        className="checkout-manage-address-link"
                      >
                        Manage addresses
                      </Link>
                    </div>

                    {loadingAddresses ? (
                      <p className="checkout-muted">Loading your addresses...</p>
                    ) : addresses.length === 0 ? (
                      <div className="checkout-no-address">
                        <MapPin size={28} />
                        <strong>No saved delivery address</strong>
                        <p>
                          Add an address in your customer dashboard before
                          continuing.
                        </p>
                        <Link
                          to="/account/dashboard"
                          className="checkout-add-address-button"
                        >
                          <Plus size={15} /> ADD DELIVERY ADDRESS
                        </Link>
                      </div>
                    ) : (
                      <div className="checkout-address-list">
                        {addresses.map((address) => (
                          <label
                            className="checkout-address-option"
                            key={address.id}
                          >
                            <input
                              type="radio"
                              name="delivery-address"
                              value={address.id}
                              checked={selectedAddressId === address.id}
                              onChange={() =>
                                setSelectedAddressId(address.id)
                              }
                            />
                            <div className="checkout-address-option-content">
                              <strong>
                                <UserRound size={15} />
                                {address.recipient_name}
                                {address.is_default && (
                                  <span className="checkout-address-default">
                                    DEFAULT
                                  </span>
                                )}
                              </strong>
                              <p>{address.phone}</p>
                              <p>{address.address_line1}</p>
                              {address.address_line2 && (
                                <p>{address.address_line2}</p>
                              )}
                              {address.landmark && (
                                <p>Landmark: {address.landmark}</p>
                              )}
                              <p>
                                {address.locality}, {address.city}
                                {address.district
                                  ? `, ${address.district}`
                                  : ""}
                              </p>
                              <p>
                                {address.state} - {address.postal_code}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="checkout-card">
                    <div className="checkout-card-heading">
                      <div>
                        <h2>
                          <CreditCard size={19} /> Payment method
                        </h2>
                        <p>Choose how you would like to pay.</p>
                      </div>
                    </div>

                    <div className="checkout-payment-option">
                      <input
                        type="radio"
                        checked
                        readOnly
                        aria-label="Cash on Delivery"
                      />
                      <div>
                        <strong>Cash on Delivery (COD)</strong>
                        <small>
                          Pay in cash when your order is delivered.
                        </small>
                      </div>
                    </div>
                  </section>

                  <section className="checkout-card">
                    <div className="checkout-card-heading">
                      <div>
                        <h2>Order note</h2>
                        <p>Optional delivery instructions for your order.</p>
                      </div>
                    </div>

                    <label className="checkout-note-label" htmlFor="customer-note">
                      Delivery note
                    </label>
                    <textarea
                      id="customer-note"
                      className="checkout-note-input"
                      rows={3}
                      maxLength={500}
                      placeholder="Example: Please call before delivery."
                      value={customerNote}
                      onChange={(event) =>
                        setCustomerNote(event.target.value)
                      }
                    />
                  </section>
                </div>

                <aside className="checkout-sidebar">
                  <section className="checkout-card">
                    <div className="checkout-card-heading">
                      <h2>Order summary</h2>
                    </div>

                    <div className="checkout-order-items">
                      {items.map((item) => (
                        <div className="checkout-order-item" key={item.id}>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} />
                          ) : (
                            <div className="checkout-order-item-image">
                              <Package size={19} />
                            </div>
                          )}
                          <div className="checkout-order-item-info">
                            <strong>{item.name}</strong>
                            <small>Qty: {item.quantity}</small>
                          </div>
                          <strong className="checkout-order-item-price">
                            {formatPrice(item.selling_price * item.quantity)}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div className="checkout-bill">
                      <div className="checkout-bill-title">
                        <div>
                          <strong>PRICE BREAKDOWN</strong>
                          <span>See how your bill is calculated</span>
                        </div>
                        <span className="checkout-estimate-pill">ESTIMATE</span>
                      </div>
                      <div className="checkout-bill-items">
                        {items.map((item) => (
                          <div className="checkout-bill-item" key={item.id}>
                            <span>
                              {item.name}
                              <small>{formatPrice(item.selling_price)} × {item.quantity}</small>
                            </span>
                            <strong>{formatPrice(item.selling_price * item.quantity)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="checkout-bill-divider" />
                      <div className="cart-summary-row checkout-summary-row">
                        <span>Items subtotal</span>
                        <strong>{formatPrice(subtotal)}</strong>
                      </div>
                      <div className="cart-summary-row checkout-summary-row">
                        <span>Delivery charge</span>
                        <strong className="checkout-pending-charge">To be calculated</strong>
                      </div>
                      <div className="cart-summary-row checkout-summary-row">
                        <span>Taxes / other charges</span>
                        <strong className="checkout-pending-charge">If applicable</strong>
                      </div>
                      <div className="cart-summary-total">
                        <span>Estimated total</span>
                        <strong>{formatPrice(subtotal)}*</strong>
                      </div>
                      <p className="checkout-price-note">
                        *This is an estimate based on the cart prices. The server checks current product prices and calculates delivery, taxes, discounts and the final payable amount when you place the order.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="checkout-place-order-button"
                      onClick={() => void handlePlaceOrder()}
                      disabled={
                        placingOrder ||
                        loadingAddresses ||
                        !selectedAddressId ||
                        addresses.length === 0
                      }
                    >
                      {placingOrder ? (
                        "PLACING ORDER..."
                      ) : (
                        <>
                          <Truck size={17} /> PLACE COD ORDER
                        </>
                      )}
                    </button>

                    <p className="checkout-secure-note">
                      Your order will be submitted securely. Do not refresh
                      while the order is being placed.
                    </p>
                  </section>

                  {selectedAddress && (
                    <section className="checkout-card checkout-selected-address">
                      <h3>Delivering to</h3>
                      <strong>{selectedAddress.recipient_name}</strong>
                      <p>
                        {selectedAddress.city}, {selectedAddress.state}
                      </p>
                    </section>
                  )}
                </aside>
              </div>
            ) : (
              <div className="cart-layout">
                <section className="cart-items">
                  {items.map((item) => (
                    <article className="cart-item" key={item.id}>
                      <div className="cart-item-image">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} />
                        ) : (
                          <span>999+ KART</span>
                        )}
                      </div>

                      <div className="cart-item-info">
                        <h3>{item.name}</h3>
                        <strong>{formatPrice(item.selling_price)}</strong>

                        <div className="cart-quantity">
                          <button
                            type="button"
                            aria-label={`Decrease ${item.name} quantity`}
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                          >
                            <Minus size={13} />
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            aria-label={`Increase ${item.name} quantity`}
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        <button
                          type="button"
                          className="cart-remove"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>

                      <strong className="cart-line-total">
                        {formatPrice(item.selling_price * item.quantity)}
                      </strong>
                    </article>
                  ))}
                </section>

                <aside className="cart-summary">
                  <h2>Order summary</h2>

                  <div className="cart-summary-row">
                    <span>Items ({cartCount})</span>
                    <strong>{formatPrice(subtotal)}</strong>
                  </div>
                  <div className="cart-summary-row">
                    <span>Delivery charge</span>
                    <span>Calculated at checkout</span>
                  </div>
                  <div className="cart-summary-total">
                    <span>Estimated subtotal</span>
                    <strong>{formatPrice(subtotal)}</strong>
                  </div>
                  <p className="cart-bill-hint">
                    Final bill is calculated securely when you place your order.
                  </p>

                  <button
                    type="button"
                    className="cart-checkout-button"
                    onClick={openCheckout}
                  >
                    PROCEED TO CHECKOUT <ArrowRight size={15} />
                  </button>

                  <p className="cart-cod-note">
                    Cash on Delivery available
                  </p>
                </aside>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="cart-footer">
        © 2026 999+ KART. All rights reserved.
      </footer>
    </div>
  );
}
