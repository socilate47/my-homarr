FROM golang:1.23-alpine AS build

WORKDIR /src
COPY go.mod main.go ./
RUN go build -trimpath -ldflags="-s -w" -o /out/homarr-discovery-agent .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates docker-cli

COPY --from=build /out/homarr-discovery-agent /usr/local/bin/homarr-discovery-agent
ENTRYPOINT ["/usr/local/bin/homarr-discovery-agent"]
