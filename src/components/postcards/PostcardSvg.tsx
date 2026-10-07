/** Renders trusted, server-generated postcard SVG markup responsively. */
export default function PostcardSvg({ svg, className = "" }: { svg: string; className?: string }) {
  return (
    <div
      className={`overflow-hidden [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      // Markup is produced by our own renderer; all text is XML-escaped there.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
