import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IAM CO Exam Management",
    short_name: "IAM CO",
    description:
      "Exam management for IAM Community College — grades, attendance, and reports.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1A56A0",
    orientation: "portrait",
    icons: [
      {
        src: "/IAMCOLOGO.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/IAMCOLOGO.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/IAMCOLOGO.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
