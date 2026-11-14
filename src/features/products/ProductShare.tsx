
import { useState } from "react";
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
  Link2,
  Camera,
} from "lucide-react";
import "./ProductShare.css";

interface ProductShareProps {
  productId: string;
  productName: string;
  productPrice: string;
}

export default function ProductShare({
  productId,
  productName,
  productPrice,
}: ProductShareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const productUrl =
    `${window.location.origin}/product/${productId}`;

  const shareText =
    `Check out ${productName} at 999+ KART!\n` +
    `Price: ${productPrice}\n\n` +
    productUrl;

  async function copyProductLink() {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      window.prompt("Copy this product link:", productUrl);
    }
  }

  function shareWhatsApp() {
    const url =
      `https://wa.me/?text=${encodeURIComponent(shareText)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function shareFacebook() {
    const url =
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function shareInstagram() {
    await copyProductLink();
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="product-share-wrapper"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="product-share-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Share product"
        aria-expanded={isOpen}
      >
        <Share2 size={17} />
        <span>SHARE PRODUCT</span>
      </button>

      {isOpen && (
        <div className="product-share-menu">
          <div className="product-share-heading">
            <strong>Share this product</strong>

            <button
              type="button"
              className="product-share-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close share menu"
            >
              ×
            </button>
          </div>

          <button
            type="button"
            className="product-share-option"
            onClick={copyProductLink}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            <span>{copied ? "Link copied!" : "Copy product URL"}</span>
          </button>

          <button
            type="button"
            className="product-share-option whatsapp"
            onClick={shareWhatsApp}
          >
            <MessageCircle size={18} />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            className="product-share-option facebook"
            onClick={shareFacebook}
          >
            <Link2 size={18} />
            <span>Facebook</span>
          </button>

          <button
            type="button"
            className="product-share-option instagram"
            onClick={shareInstagram}
          >
            <Camera size={18} />
            <span>Instagram</span>
          </button>
        </div>
      )}
    </div>
  );
}
