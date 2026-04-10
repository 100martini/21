.PHONY: build start stop restart logs clean fclean help

GREEN  := \033[0;32m
RED    := \033[0;31m
YELLOW := \033[0;33m
NC     := \033[0m

help:
	@echo ""
	@echo "  $(YELLOW)make build$(NC)           : Build Docker images"
	@echo "  $(YELLOW)make build-no-cache$(NC)  : Build from scratch (no cache)"
	@echo "  $(YELLOW)make start$(NC)           : Start all services"
	@echo "  $(YELLOW)make stop$(NC)            : Stop all services"
	@echo "  $(YELLOW)make restart$(NC)         : Restart all services"
	@echo "  $(YELLOW)make clean$(NC)           : Remove containers and volumes"
	@echo "  $(YELLOW)make fclean$(NC)          : Full cleanup (containers, images, node_modules)"
	@echo "  $(YELLOW)make status$(NC)          : Show running containers"
	@echo ""

build:
	@echo "Building images"
	@docker compose build
	@echo "$(GREEN)Build complete.$(NC)"

build-no-cache:
	@echo "Building images from scratch"
	@docker compose build --no-cache
	@echo "$(GREEN)Build complete.$(NC)"

start:
	@echo "Starting services"
	@docker compose up -d
	@echo ""
	@echo "  $(GREEN)Wanna see?$(NC) → $(YELLOW)https://localhost:8443$(NC)"
	@echo ""

stop:
	@echo "Stopping services"
	@docker compose down

restart: stop start

logs:
	@docker compose logs -f

logs-f:
	@docker compose logs -f frontend

logs-b:
	@docker compose logs -f backend

status:
	@docker compose ps

clean:
	@echo "$(RED)Removing all containers and volumes$(NC)"
	@docker compose down -v
	@docker system prune -f
	@echo "$(GREEN)Cleanup complete.$(NC)"

fclean:
	@echo "$(RED)Removing containers, volumes, images and build artifacts$(NC)"
	@docker compose down -v --rmi all
	@docker system prune -af
	@rm -rf frontend/node_modules frontend/dist
	@rm -rf backend/node_modules
	@echo "$(GREEN)Full cleanup complete.$(NC)"

.DEFAULT_GOAL := help
