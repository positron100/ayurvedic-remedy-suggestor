import { disclaimer, siteConfig } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-subtle/50">
      <div className="container-px mx-auto max-w-5xl py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <p className="font-display text-lg font-medium text-fg">{siteConfig.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{disclaimer.full}</p>
          </div>
          <p className="text-sm text-fg-faint">
            Built by {siteConfig.author}. {new Date().getFullYear()}.
          </p>
        </div>
      </div>
    </footer>
  );
}
