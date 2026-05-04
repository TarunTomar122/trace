import React from 'react';

/**
 * Renders JSON-LD structured data in a <script type="application/ld+json"> tag.
 * Usage: <StructuredData data={schemaObject} />
 */
export function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      suppressHydrationWarning
    />
  );
}

/**
 * Renders multiple JSON-LD schemas in separate script tags.
 * Each entry in `schemas` renders its own script tag.
 */
export function StructuredDataList({
  schemas,
}: {
  schemas: Record<string, unknown>[];
}) {
  return (
    <>
      {schemas.map((data, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          suppressHydrationWarning
        />
      ))}
    </>
  );
}
