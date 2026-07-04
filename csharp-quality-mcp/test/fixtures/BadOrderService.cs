using System;
using System.Collections.Generic;

namespace Demo;

// Intentionally poor design for SolidGuard demos:
// - SRP violation: pricing, persistence, notification, and logging in one class
// - High cyclomatic complexity in ProcessOrder
// - Magic numbers, deep nesting, poor naming
public class BadOrderService
{
    public List<string> log = new List<string>();

    public double ProcessOrder(int type, int qty, string country, bool rush, bool member)
    {
        double price = 0;
        if (type == 1)
        {
            price = 10;
            if (qty > 100) { price = price * qty * 0.8; }
            else if (qty > 50) { price = price * qty * 0.9; }
            else { price = price * qty; }
        }
        else if (type == 2)
        {
            price = 20;
            if (country == "US") { price = price * qty; if (rush) { price += 15; } }
            else if (country == "EU") { price = price * qty * 1.2; if (rush) { price += 25; } }
            else { price = price * qty * 1.5; if (rush) { price += 40; } }
        }
        else if (type == 3)
        {
            price = 30;
            if (member) { price = price * qty * 0.7; } else { price = price * qty; }
        }
        else
        {
            price = qty;
        }

        if (member && price > 1000) { price = price * 0.95; }

        // Persistence concern leaking into the same method
        SaveToDatabase(price);
        // Notification concern leaking too
        SendEmail("Order processed: " + price);
        log.Add("processed " + price);
        return price;
    }

    public void SaveToDatabase(double amount)
    {
        Console.WriteLine("INSERT INTO orders VALUES (" + amount + ")");
    }

    public void SendEmail(string body)
    {
        Console.WriteLine("Sending email: " + body);
    }
}
