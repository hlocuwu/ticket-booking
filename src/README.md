# Ticket Booking System

This project is a microservices-based ticket booking system consisting of multiple backend services written in Go and Python, as well as a frontend built with React.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

## How to Run Locally

You can run the entire application cluster locally using Docker Compose. The configuration is already set up to spin up the database, cache, and all microservices.

1. **Navigate to the project root directory:**

   ```bash
   cd DACN/ticket-booking
   ```

2. **Build and start the containers:**

   ```bash
   docker-compose up -d --build
   ```

   *Note: This will download the Postgres and Redis images, build all the microservice Docker images (Go APIs & React Frontend), and start them in the background.*

3. **Verify the services are running:**

   You can check the status of your containers with:
   ```bash
   docker-compose ps
   ```

### Exposed Services & Ports

Once everything is up and running, the services will be accessible at the following local ports:

- **Frontend (UI)**: [http://localhost:3000](http://localhost:3000)
- **Inventory Service**: [http://localhost:8081](http://localhost:8081)
- **Waiting Room Service**: [http://localhost:8082](http://localhost:8082)
- **Booking Service**: [http://localhost:8083](http://localhost:8083)
- **Event Service**: [http://localhost:8084](http://localhost:8084)
- **Auth Service**: [http://localhost:8085](http://localhost:8085)

#### Infrastructure Services
- **PostgreSQL Database**: Port `5432` *(Username: `ticket_admin`, DB: `ticket_db`)*
- **Redis Cache**: Port `6379`

## Viewing Logs

If you want to view the logs for a specific service (e.g., `frontend`, `booking`, or `auth`), use the following command:

```bash
docker-compose logs -f <service_name>
# Example:
docker-compose logs -f frontend
docker-compose logs -f auth
```

## Stopping the Application

To stop the containers without removing the data volumes:

```bash
docker-compose stop
```

To entirely stop and remove the containers, networks, and recreate everything from scratch next time (preserve volumes unless `-v` is provided):

```bash
docker-compose down
```