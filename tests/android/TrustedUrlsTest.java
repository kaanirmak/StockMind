import com.kaanirmak.stockmind.TrustedUrls;

public class TrustedUrlsTest {
    public static void main(String[] args) {
        String origin = "https://stockmind.kaanrmak7.workers.dev";
        String[] invalid = {
            origin + ".attacker.example/", origin + "@attacker.example/",
            "http://stockmind.kaanrmak7.workers.dev/", origin + ":444/",
            "javascript:alert(1)", "file:///data/data/app/file", "content://provider/file",
            "https://github.com/attacker/update.apk", "https://localhost/", "https://attacker.example/",
            "https://user@stockmind.kaanrmak7.workers.dev/", origin + "\\@attacker.example/",
            "https://stockmind.kaanrmak7.workers.dev./"
        };
        for (String url : invalid) {
            if (TrustedUrls.isTrusted(url, origin, false)) throw new AssertionError("Accepted untrusted URL: " + url);
        }
        if (TrustedUrls.isTrusted(null, origin, false)) throw new AssertionError("Accepted null");
        for (String url : new String[] {origin, origin + "/dashboard", origin + ":443/api/download/apk"}) {
            if (!TrustedUrls.isTrusted(url, origin, false)) throw new AssertionError("Rejected production URL");
        if (!TrustedUrls.isTrusted("https://backup.stockmind.example/", "https://backup.stockmind.example", false)) {
            throw new AssertionError("Rejected configured HTTPS origin");
        }
        }
        String dev = "http://10.0.2.2:3000";
        if (!TrustedUrls.isTrusted(dev + "/dashboard", dev, true)) throw new AssertionError("Rejected development origin");
        for (String url : new String[] {dev, "http://10.0.2.2:3001/", dev + ".attacker.example/"}) {
            if (TrustedUrls.isTrusted(url, origin, false)) throw new AssertionError("Development URL in release");
        }
        if (TrustedUrls.isTrusted("http://10.0.2.2:3001/", dev, true)) throw new AssertionError("Development port bypass");
        System.out.println("TrustedUrls: production, debug, prefix, userinfo, scheme and port checks passed");
    }
}
