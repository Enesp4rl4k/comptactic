// Validate (1) graceful no-LLM review and (2) the sandbox verification loop.
import { reviewCsharp } from "../dist/tools/reviewCsharp.js";
import { verifyPatch } from "../dist/tools/verifyPatch.js";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "..", "test", "fixtures", "BadOrderService.cs");

console.error("== 1) review_csharp (no API key -> deterministic only) ==");
const review = await reviewCsharp({ filePath: fixture });
console.log(review.markdown);

console.error("\n== 2) verify_patch with a hand-written refactor ==");
const refactor = `using System;
using System.Collections.Generic;

namespace Demo;

public class BadOrderService
{
    private readonly List<string> _log = new();

    public double ProcessOrder(int type, int qty, string country, bool rush, bool member)
    {
        double price = type switch
        {
            1 => PriceTypeOne(qty),
            2 => PriceTypeTwo(qty, country, rush),
            3 => member ? qty * 30 * 0.7 : qty * 30,
            _ => qty,
        };

        if (member && price > 1000)
        {
            price *= 0.95;
        }

        SaveToDatabase(price);
        SendEmail("Order processed: " + price);
        _log.Add("processed " + price);
        return price;
    }

    private static double PriceTypeOne(int qty)
    {
        const double unit = 10;
        if (qty > 100) return unit * qty * 0.8;
        if (qty > 50) return unit * qty * 0.9;
        return unit * qty;
    }

    private static double PriceTypeTwo(int qty, string country, bool rush)
    {
        const double unit = 20;
        return country switch
        {
            "US" => unit * qty + (rush ? 15 : 0),
            "EU" => unit * qty * 1.2 + (rush ? 25 : 0),
            _ => unit * qty * 1.5 + (rush ? 40 : 0),
        };
    }

    private static void SaveToDatabase(double amount) =>
        Console.WriteLine("INSERT INTO orders VALUES (" + amount + ")");

    private static void SendEmail(string body) =>
        Console.WriteLine("Sending email: " + body);
}
`;

const verified = await verifyPatch({
  filePath: fixture,
  targetFile: "BadOrderService.cs",
  newContent: refactor,
});
console.log(verified.markdown);
console.error("verified:", verified.verified, "| compiles:", verified.compileOk);
