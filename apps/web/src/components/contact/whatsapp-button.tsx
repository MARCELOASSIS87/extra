import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * O número nunca é exibido como texto em lugar nenhum da interface (§16.5):
 * número escrito na tela é número copiado e colado no grupo, e aí o
 * anti-raspagem virou enfeite. Ele só existe dentro do `href`, e a única
 * coisa que a pessoa vê é o botão.
 */
export function WhatsappButton({
  phone,
  label,
  message,
  variant = "outline",
  size = "sm",
  className,
}: {
  phone: string;
  label: string;
  message?: string;
  variant?: "default" | "outline";
  size?: "sm" | "lg";
  className?: string;
}) {
  const query = message ? `?text=${encodeURIComponent(message)}` : "";

  return (
    <a
      href={`https://wa.me/${phone.replace(/\D/g, "")}${query}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size }), className)}
    >
      <MessageCircle aria-hidden="true" className="size-3.5" />
      {label}
    </a>
  );
}
