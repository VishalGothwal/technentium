import { describe, expect, it } from "vitest";
import { pasteListToCsv } from "@/lib/device-import";

describe("paste list → import CSV", () => {
  it("reads Brand, Model and an optional year per line", () => {
    expect(pasteListToCsv("phone", "Samsung, Galaxy A57, 2026\n\n  Nothing, Phone (4)  ")).toBe(
      ["category,brand,model,releaseYear,frame,popular,aliases", "phone,Samsung,Galaxy A57,2026,,,", "phone,Nothing,Phone (4),,,,"].join("\n"),
    );
  });

  it("keeps commas inside the model name and accepts tab-separated rows", () => {
    expect(pasteListToCsv("laptop", "Dell, Inspiron 14, 5440, 2024\nHP\tOmniBook X\t2024").split("\n").slice(1)).toEqual([
      'laptop,Dell,"Inspiron 14, 5440",2024,,,',
      "laptop,HP,OmniBook X,2024,,,",
    ]);
  });
});
