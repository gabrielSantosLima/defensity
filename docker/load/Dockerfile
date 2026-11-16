FROM eclipse-temurin:21-jdk

ENV JAVA_HOME=/opt/java/openjdk

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL \
    https://github.com/gatling/gatling/releases/download/v3.16.0/gatling-bundle-3.16.0.zip \
    -o /tmp/gatling.zip \
  && unzip -q /tmp/gatling.zip -d /opt \
  && cd /opt && for dir in gatling*; do [ -d "$dir" ] && mv "$dir" /opt/gatling; done \
  && rm -f /tmp/gatling.zip

COPY LoadSimulation.java /opt/gatling/src/test/java/defensity/LoadSimulation.java

WORKDIR /opt/gatling

RUN chmod +x mvnw && ./mvnw -q -DskipTests test-compile

ENTRYPOINT ["./mvnw", "-q", "gatling:test", "-Dgatling.simulationClass=defensity.LoadSimulation"]
