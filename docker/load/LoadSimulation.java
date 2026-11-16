package defensity;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;
import java.time.Duration;

public class LoadSimulation extends Simulation {

  private static String env(String name, String fallback) {
    String value = System.getenv(name);
    return value == null || value.isBlank() ? fallback : value;
  }

  public LoadSimulation() {
    String baseUrl = env("TARGET_URL", "");
    String path = env("TARGET_PATH", "/");
    double rate = Double.parseDouble(env("USERS_PER_SECOND", "5"));
    int duration = Integer.parseInt(env("DURATION_SECONDS", "10"));

    HttpProtocolBuilder httpProtocol =
        http.baseUrl(baseUrl)
            .acceptHeader("application/json,text/html,*/*")
            .userAgentHeader("defensity/0.0.0")
            .disableFollowRedirect();

    ScenarioBuilder scenario =
        scenario("defensity-load").exec(http("target").get(path));

    setUp(
            scenario.injectOpen(
                constantUsersPerSec(rate).during(Duration.ofSeconds(duration))))
        .protocols(httpProtocol)
        .maxDuration(Duration.ofSeconds(duration + 10));
  }
}
