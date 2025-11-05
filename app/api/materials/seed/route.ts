import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, withErrorHandling } from '@/lib/api-helpers';

// Seed data: ~50 materials across all categories
const seedMaterials = [
  // Material Category (~8)
  {
    name: 'Gold',
    category: 'Material',
    prompt: 'Luxurious 18k gold with a warm, rich yellow tone. This premium precious metal has a brilliant luster and exceptional durability. The gold should have a smooth, polished finish that reflects light beautifully, creating depth and elegance. Use for high-end jewelry pieces that require sophistication and timeless appeal.',
    isGlobal: true,
  },
  {
    name: 'Silver',
    category: 'Material',
    prompt: 'Sterling silver with a bright, cool white metallic finish. This precious metal has excellent malleability and a distinctive shine. The silver should have a polished or brushed finish depending on the design, with a subtle reflective quality that catches light elegantly. Ideal for both classic and contemporary jewelry designs.',
    isGlobal: true,
  },
  {
    name: 'Platinum',
    category: 'Material',
    prompt: 'Premium platinum with a sophisticated white-gray metallic appearance. This rare precious metal is exceptionally durable and hypoallergenic. The platinum should have a polished finish with a subtle, understated elegance. It has a heavier, more substantial feel than gold or silver, perfect for luxury jewelry pieces.',
    isGlobal: true,
  },
  {
    name: 'Rose Gold',
    category: 'Material',
    prompt: 'Elegant rose gold with a warm, romantic pinkish-copper hue. This alloy combines gold with copper, creating a distinctive rose or pink tone. The rose gold should have a soft, romantic appearance with a polished finish that reflects light warmly. Perfect for creating jewelry with a vintage or romantic aesthetic.',
    isGlobal: true,
  },
  {
    name: 'White Gold',
    category: 'Material',
    prompt: 'Sophisticated white gold with a cool, silvery-white appearance. This alloy is created by mixing gold with white metals like nickel or palladium and is often rhodium-plated for extra brightness. The white gold should have a brilliant, mirror-like finish that complements diamonds and other gemstones beautifully.',
    isGlobal: true,
  },
  {
    name: 'Titanium',
    category: 'Material',
    prompt: 'Modern titanium with a dark gray to black metallic finish. This lightweight yet extremely strong metal has a contemporary, industrial aesthetic. The titanium can have various finishes including brushed, polished, or anodized with vibrant colors. Perfect for modern, minimalist jewelry designs with a bold, distinctive look.',
    isGlobal: true,
  },
  {
    name: 'Brass',
    category: 'Material',
    prompt: 'Vintage brass with a warm, golden-yellow appearance that develops a rich patina over time. This alloy has an antique, nostalgic quality. The brass can be polished to a bright shine or left with a matte finish for a more rustic look. Ideal for bohemian, vintage, or artisanal jewelry styles.',
    isGlobal: true,
  },
  {
    name: 'Copper',
    category: 'Material',
    prompt: 'Artisan copper with a distinctive reddish-orange metallic color that naturally oxidizes to a verdigris patina. This metal has excellent malleability and a warm, earthy tone. The copper can be polished, brushed, or intentionally oxidized for an antique finish. Perfect for bohemian, handmade, or rustic jewelry designs.',
    isGlobal: true,
  },

  // Type Category (~8)
  {
    name: 'Ring',
    category: 'Type',
    prompt: 'A classic ring design, typically circular with an open center. The ring should have a comfortable band width, proportional to the overall design. It can feature a central setting for gemstones or decorative elements. The ring should be designed to sit elegantly on the finger with smooth, rounded edges for comfort.',
    isGlobal: true,
  },
  {
    name: 'Necklace',
    category: 'Type',
    prompt: 'An elegant necklace design that drapes gracefully around the neck. The necklace should have a chain or cord with a secure clasp mechanism. It can feature pendants, gemstones, or decorative elements along the length. The necklace should be designed to hang naturally, creating a flattering silhouette. Chain links should be smooth and well-proportioned.',
    isGlobal: true,
  },
  {
    name: 'Bracelet',
    category: 'Type',
    prompt: 'A stylish bracelet that wraps around the wrist comfortably. The bracelet can be a solid band, chain-linked, or feature decorative elements. It should have a secure closure mechanism and be designed to move fluidly with the wrist. The bracelet should maintain its shape while allowing comfortable movement.',
    isGlobal: true,
  },
  {
    name: 'Earrings',
    category: 'Type',
    prompt: 'Elegant earrings designed to adorn the earlobe. The earrings can be studs, drops, hoops, or danglers. They should have secure posts or hooks for attachment. The design should be balanced and proportional, creating visual interest without being too heavy. Earrings should catch light beautifully when worn.',
    isGlobal: true,
  },
  {
    name: 'Pendant',
    category: 'Type',
    prompt: 'A decorative pendant designed to hang from a necklace chain. The pendant should have a bail or loop at the top for attachment. It can feature gemstones, intricate designs, or symbolic shapes. The pendant should be well-balanced and designed to rest elegantly against the chest when worn. It should be the focal point of the necklace design.',
    isGlobal: true,
  },
  {
    name: 'Brooch',
    category: 'Type',
    prompt: 'An ornamental brooch designed to be pinned to clothing. The brooch should have a secure pin mechanism on the back. It can feature decorative elements, gemstones, or intricate designs. The brooch should be designed to sit flat against fabric while adding an elegant accent. Perfect for adding sophistication to lapels, scarves, or jackets.',
    isGlobal: true,
  },
  {
    name: 'Choker',
    category: 'Type',
    prompt: 'A close-fitting choker necklace that sits high on the neck. The choker should have an adjustable closure for comfort. It can be a solid band, chain-linked, or feature decorative elements. The design should be snug but not constricting, creating a bold, statement look. Chokers should have smooth edges and comfortable padding.',
    isGlobal: true,
  },
  {
    name: 'Cuff',
    category: 'Type',
    prompt: 'A bold cuff bracelet with an open design that slides onto the wrist. The cuff should have a wide, statement-making band with decorative elements. It can feature engravings, gemstones, or geometric patterns. The cuff should maintain its shape while being easy to put on and remove. Perfect for creating a strong, fashion-forward look.',
    isGlobal: true,
  },

  // Style Category (~8)
  {
    name: 'Art Deco',
    category: 'Style',
    prompt: 'Art Deco style jewelry featuring geometric patterns, bold lines, and symmetrical designs. Characterized by sharp angles, stepped patterns, and a mix of bold colors. The design should evoke the 1920s-1930s era with clean, architectural lines. Often incorporates geometric shapes like chevrons, sunbursts, and zigzags. Perfect for creating sophisticated, vintage-inspired pieces with a modern edge.',
    isGlobal: true,
  },
  {
    name: 'Vintage',
    category: 'Style',
    prompt: 'Vintage-style jewelry with nostalgic, antique-inspired designs. Characterized by ornate details, intricate patterns, and a sense of timeless elegance. The design should evoke past eras with romantic, classical elements. Often features filigree work, delicate engravings, and warm patinas. Perfect for creating pieces with historical charm and romantic appeal.',
    isGlobal: true,
  },
  {
    name: 'Modern',
    category: 'Style',
    prompt: 'Modern jewelry design with clean lines, minimalist aesthetics, and contemporary shapes. Characterized by simplicity, geometric forms, and a focus on form over ornamentation. The design should feel current and forward-thinking while maintaining elegance. Often features sleek surfaces, bold silhouettes, and innovative materials. Perfect for creating sophisticated, understated pieces with a contemporary edge.',
    isGlobal: true,
  },
  {
    name: 'Minimalist',
    category: 'Style',
    prompt: 'Minimalist jewelry with extreme simplicity and clean design. Characterized by simple geometric shapes, unadorned surfaces, and a focus on essential elements. The design should be stripped down to its purest form, emphasizing quality over quantity. Often features thin bands, single gemstones, and subtle details. Perfect for creating elegant, timeless pieces with understated sophistication.',
    isGlobal: true,
  },
  {
    name: 'Baroque',
    category: 'Style',
    prompt: 'Baroque-style jewelry with elaborate, ornate designs and dramatic details. Characterized by rich ornamentation, flowing curves, and a sense of grandeur. The design should evoke the opulence of the Baroque period with intricate patterns and luxurious materials. Often features scrolls, shells, and elaborate floral motifs. Perfect for creating statement pieces with dramatic, theatrical appeal.',
    isGlobal: true,
  },
  {
    name: 'Bohemian',
    category: 'Style',
    prompt: 'Bohemian jewelry with free-spirited, eclectic designs and artisanal craftsmanship. Characterized by organic shapes, natural materials, and a relaxed, earthy aesthetic. The design should feel handcrafted and inspired by nature. Often features raw gemstones, mixed metals, and irregular, organic forms. Perfect for creating pieces with a laid-back, artistic, and unique character.',
    isGlobal: true,
  },
  {
    name: 'Classic',
    category: 'Style',
    prompt: 'Classic jewelry design with timeless elegance and traditional aesthetics. Characterized by balanced proportions, refined details, and enduring appeal. The design should feel familiar and sophisticated, transcending trends. Often features symmetrical designs, traditional settings, and premium materials. Perfect for creating pieces with universal appeal and lasting beauty.',
    isGlobal: true,
  },
  {
    name: 'Contemporary',
    category: 'Style',
    prompt: 'Contemporary jewelry with current design trends and innovative approaches. Characterized by fresh perspectives, unique combinations, and a modern sensibility. The design should feel current and fashion-forward while maintaining wearability. Often features unexpected materials, asymmetric designs, and creative interpretations of traditional forms. Perfect for creating pieces that reflect current aesthetic sensibilities.',
    isGlobal: true,
  },

  // Shape Category (~6)
  {
    name: 'Round',
    category: 'Shape',
    prompt: 'Round or circular shapes in jewelry design. Characterized by smooth curves, perfect circles, and radial symmetry. The round shape should be well-proportioned and balanced, creating a harmonious appearance. Often used for gemstone cuts, bezels, and decorative elements. Perfect for creating classic, timeless designs with universal appeal.',
    isGlobal: true,
  },
  {
    name: 'Oval',
    category: 'Shape',
    prompt: 'Oval or elliptical shapes in jewelry design. Characterized by elongated circular forms with smooth, flowing curves. The oval shape should be well-proportioned, typically with a 1.5:1 or 2:1 length-to-width ratio. Often used for gemstone cuts and pendant shapes. Perfect for creating elegant, flattering designs that elongate and add sophistication.',
    isGlobal: true,
  },
  {
    name: 'Square',
    category: 'Shape',
    prompt: 'Square or geometric shapes in jewelry design. Characterized by straight edges, right angles, and architectural precision. The square shape should have clean, sharp lines and perfect symmetry. Often used for modern, minimalist designs and geometric patterns. Perfect for creating contemporary pieces with bold, structured aesthetics.',
    isGlobal: true,
  },
  {
    name: 'Heart',
    category: 'Shape',
    prompt: 'Heart shapes in jewelry design. Characterized by romantic, symmetrical curves forming the classic heart silhouette. The heart shape should be well-proportioned with smooth, flowing curves. Often used for pendants, charms, and romantic jewelry pieces. Perfect for creating sentimental, romantic pieces with emotional appeal.',
    isGlobal: true,
  },
  {
    name: 'Pear',
    category: 'Shape',
    prompt: 'Pear or teardrop shapes in jewelry design. Characterized by a rounded bottom tapering to a pointed top, creating an elegant droplet silhouette. The pear shape should be well-balanced with smooth, flowing curves. Often used for gemstone cuts and pendant designs. Perfect for creating elegant, feminine pieces with sophisticated appeal.',
    isGlobal: true,
  },
  {
    name: 'Marquise',
    category: 'Shape',
    prompt: 'Marquise or navette shapes in jewelry design. Characterized by an elongated oval with pointed ends, creating an elegant boat-like silhouette. The marquise shape should be well-proportioned with smooth curves and sharp, precise points. Often used for gemstone cuts and decorative elements. Perfect for creating distinctive, elegant pieces with a unique character.',
    isGlobal: true,
  },

  // Gemstone Category (~8)
  {
    name: 'Diamond',
    category: 'Gemstone',
    prompt: 'Brilliant diamond gemstone with exceptional clarity and fire. The diamond should have a classic brilliant cut with multiple facets that create spectacular light reflection and dispersion. The stone should appear colorless or near-colorless with excellent transparency. The diamond should sparkle brilliantly, creating a mesmerizing play of light. Perfect for creating luxurious, high-end jewelry pieces with timeless elegance.',
    isGlobal: true,
  },
  {
    name: 'Ruby',
    category: 'Gemstone',
    prompt: 'Rich ruby gemstone with a deep, vibrant red color. The ruby should have excellent clarity and a rich, saturated red hue ranging from pinkish-red to deep crimson. The stone should have a vitreous luster and excellent transparency. The ruby should appear luxurious and regal, with a warm, passionate color. Perfect for creating dramatic, statement jewelry pieces with intense visual impact.',
    isGlobal: true,
  },
  {
    name: 'Emerald',
    category: 'Gemstone',
    prompt: 'Lush emerald gemstone with a rich, vibrant green color. The emerald should have a deep, saturated green hue with excellent color consistency. The stone should have a vitreous to velvety luster and may include characteristic inclusions. The emerald should appear luxurious and fresh, with a cool, sophisticated green tone. Perfect for creating elegant, nature-inspired jewelry pieces with refined beauty.',
    isGlobal: true,
  },
  {
    name: 'Sapphire',
    category: 'Gemstone',
    prompt: 'Brilliant sapphire gemstone with a rich, deep blue color. The sapphire should have excellent clarity and a vibrant blue hue ranging from cornflower blue to deep royal blue. The stone should have a vitreous luster and excellent transparency. The sapphire should appear luxurious and sophisticated, with a cool, calming blue tone. Perfect for creating elegant, statement jewelry pieces with classic appeal.',
    isGlobal: true,
  },
  {
    name: 'Pearl',
    category: 'Gemstone',
    prompt: 'Lustrous pearl with a smooth, iridescent surface and natural luster. The pearl should have a spherical or near-spherical shape with a soft, creamy white or slightly pinkish tone. The surface should show beautiful iridescence and orient, creating a rainbow-like play of colors. The pearl should appear elegant and timeless, with a soft, organic beauty. Perfect for creating classic, feminine jewelry pieces with sophisticated appeal.',
    isGlobal: true,
  },
  {
    name: 'Amethyst',
    category: 'Gemstone',
    prompt: 'Beautiful amethyst gemstone with a rich, deep purple color. The amethyst should have excellent clarity and a vibrant purple hue ranging from light lavender to deep violet. The stone should have a vitreous luster and excellent transparency. The amethyst should appear mystical and elegant, with a cool, regal purple tone. Perfect for creating distinctive, colorful jewelry pieces with unique character.',
    isGlobal: true,
  },
  {
    name: 'Topaz',
    category: 'Gemstone',
    prompt: 'Brilliant topaz gemstone with a warm, golden-yellow or blue color. The topaz should have excellent clarity and a vibrant, saturated hue. The stone should have a vitreous luster and excellent transparency with strong brilliance. The topaz should appear luxurious and vibrant, with a warm, sunny appearance. Perfect for creating bright, cheerful jewelry pieces with excellent sparkle.',
    isGlobal: true,
  },
  {
    name: 'Aquamarine',
    category: 'Gemstone',
    prompt: 'Serene aquamarine gemstone with a beautiful blue-green color reminiscent of ocean waters. The aquamarine should have excellent clarity and a light to medium blue-green hue. The stone should have a vitreous luster and excellent transparency. The aquamarine should appear fresh and calming, with a cool, tranquil blue-green tone. Perfect for creating elegant, peaceful jewelry pieces with a soothing aesthetic.',
    isGlobal: true,
  },

  // Technique Category (~6)
  {
    name: 'Filigree',
    category: 'Technique',
    prompt: 'Intricate filigree work featuring delicate, lacy metalwork created from fine wires. The filigree should show detailed patterns of twisted, curled, or braided metal wires creating openwork designs. The technique should appear delicate and ornate, with precise craftsmanship. The design should be airy and light, creating visual interest through negative space. Perfect for creating elegant, vintage-inspired jewelry with intricate, detailed appeal.',
    isGlobal: true,
  },
  {
    name: 'Engraving',
    category: 'Technique',
    prompt: 'Detailed engraving work featuring carved patterns, motifs, or text on metal surfaces. The engraving should show precise, clean lines with excellent craftsmanship. The designs can include floral patterns, geometric motifs, or personalized text. The engraving should add texture and visual interest while maintaining the metal\'s integrity. Perfect for creating personalized, detailed jewelry with artistic appeal.',
    isGlobal: true,
  },
  {
    name: 'Enamel',
    category: 'Technique',
    prompt: 'Vibrant enamel work featuring colored glass fused to metal surfaces. The enamel should have a smooth, glossy finish with rich, saturated colors. The technique can create intricate patterns, solid colors, or gradient effects. The enamel should be perfectly applied with no bubbles or imperfections. Perfect for creating colorful, artistic jewelry with bold visual impact and historical charm.',
    isGlobal: true,
  },
  {
    name: 'Inlay',
    category: 'Technique',
    prompt: 'Precise inlay work featuring materials set into recessed areas of metal. The inlay should be flush with the surrounding metal, creating a smooth, seamless surface. Materials can include gemstones, wood, or other metals. The technique should show excellent craftsmanship with tight, precise fits. Perfect for creating sophisticated, detailed jewelry with textural contrast and visual interest.',
    isGlobal: true,
  },
  {
    name: 'Granulation',
    category: 'Technique',
    prompt: 'Delicate granulation work featuring tiny metal beads soldered onto a surface to create patterns. The granules should be uniform in size and perfectly applied, creating detailed decorative designs. The technique should show excellent craftsmanship with precise placement. The granulation should add texture and visual interest while maintaining elegance. Perfect for creating intricate, artisanal jewelry with historical techniques.',
    isGlobal: true,
  },
  {
    name: 'Repoussé',
    category: 'Technique',
    prompt: 'Artistic repoussé work featuring metal raised from the back to create relief designs. The technique should show three-dimensional patterns with excellent depth and definition. The raised areas should be smooth and well-formed, creating dramatic light and shadow effects. The repoussé should add dimension and visual interest. Perfect for creating sculptural, artistic jewelry with dramatic, textured appeal.',
    isGlobal: true,
  },

  // Pattern Category (~4)
  {
    name: 'Floral',
    category: 'Pattern',
    prompt: 'Floral patterns featuring flowers, leaves, and botanical motifs. The patterns should be organic and flowing, with natural, graceful curves. The designs can include single flowers, bouquets, or continuous floral borders. The floral patterns should be well-balanced and harmonious, creating a romantic, nature-inspired aesthetic. Perfect for creating elegant, feminine jewelry with organic, timeless appeal.',
    isGlobal: true,
  },
  {
    name: 'Geometric',
    category: 'Pattern',
    prompt: 'Geometric patterns featuring shapes, lines, and mathematical precision. The patterns should include triangles, squares, circles, or complex tessellations. The designs should be balanced and symmetrical, creating a modern, architectural aesthetic. The geometric patterns should be precise and well-defined. Perfect for creating contemporary, structured jewelry with bold, graphic appeal.',
    isGlobal: true,
  },
  {
    name: 'Celtic',
    category: 'Pattern',
    prompt: 'Celtic patterns featuring intricate knots, interlacing lines, and symbolic motifs. The patterns should show continuous, flowing lines that weave together in complex designs. The Celtic motifs should be symmetrical and well-balanced, creating a mystical, ancient aesthetic. The patterns should be precise and detailed. Perfect for creating distinctive, cultural jewelry with historical and symbolic appeal.',
    isGlobal: true,
  },
  {
    name: 'Abstract',
    category: 'Pattern',
    prompt: 'Abstract patterns featuring non-representational designs, flowing lines, and creative compositions. The patterns should be artistic and unique, avoiding literal representations. The designs can include swirls, curves, and dynamic compositions. The abstract patterns should be balanced and visually interesting. Perfect for creating modern, artistic jewelry with creative, distinctive appeal.',
    isGlobal: true,
  },

  // Finish Category (~4)
  {
    name: 'Polished',
    category: 'Finish',
    prompt: 'Highly polished finish with a mirror-like, reflective surface. The polish should be perfect with no visible scratches or imperfections. The surface should reflect light brilliantly, creating depth and shine. The polished finish should be smooth to the touch with a premium, luxurious feel. Perfect for creating elegant, high-end jewelry with sophisticated, gleaming appeal.',
    isGlobal: true,
  },
  {
    name: 'Brushed',
    category: 'Finish',
    prompt: 'Brushed finish with fine, parallel lines creating a subtle texture. The brush marks should be uniform and consistent, creating a matte sheen. The brushed finish should feel smooth to the touch while providing visual texture. The finish should reduce glare while maintaining elegance. Perfect for creating modern, understated jewelry with a sophisticated, contemporary appeal.',
    isGlobal: true,
  },
  {
    name: 'Matte',
    category: 'Finish',
    prompt: 'Matte finish with a non-reflective, satin-like surface. The matte finish should be uniform and smooth, with no shine or gloss. The surface should have a soft, velvety appearance that absorbs light. The matte finish should feel smooth and premium. Perfect for creating modern, minimalist jewelry with a sophisticated, understated appeal.',
    isGlobal: true,
  },
  {
    name: 'Hammered',
    category: 'Finish',
    prompt: 'Hammered finish with a textured surface created by tool marks. The hammered texture should be consistent and intentional, creating visual interest through subtle dimples or patterns. The finish should add texture while maintaining elegance. The hammered finish should feel slightly textured but not rough. Perfect for creating artisanal, handcrafted jewelry with organic, tactile appeal.',
    isGlobal: true,
  },
];

export const POST = withErrorHandling(async (request: NextRequest) => {
  let created = 0;
  let skipped = 0;

  for (const materialData of seedMaterials) {
    // Check if material with same name already exists (case-insensitive)
    const existing = await prisma.material.findFirst({
      where: {
        name: {
          equals: materialData.name,
          mode: 'insensitive',
        },
        isGlobal: true,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Create the material
    await prisma.material.create({
      data: materialData,
    });

    created++;
  }

  return successResponse({
    message: `Seeded ${created} materials. ${skipped} already existed.`,
    created,
    skipped,
    total: seedMaterials.length,
  });
});

