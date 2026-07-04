using System;

namespace Demo;

// Intentionally violates DIP and OCP for SolidGuard demos:
// - DIP: depends directly on a concrete SmtpClient instead of an abstraction
// - OCP: adding a new channel requires editing Notify() (type switch)
// - Primitive obsession + stringly-typed channel selector
public class NotificationManager
{
    private readonly SmtpClient _smtp = new SmtpClient();

    public void Notify(string channel, string user, string message)
    {
        if (channel == "email")
        {
            _smtp.Send(user, message);
        }
        else if (channel == "sms")
        {
            Console.WriteLine("SMS to " + user + ": " + message);
        }
        else if (channel == "push")
        {
            Console.WriteLine("PUSH to " + user + ": " + message);
        }
        else
        {
            throw new Exception("unknown channel");
        }
    }
}

public class SmtpClient
{
    public void Send(string to, string body)
    {
        Console.WriteLine("EMAIL to " + to + ": " + body);
    }
}
