# Kraken Salvage Co. -- 1986 Edition
#
# Build:   make
# Run:     ./kraken
# Clean:   make clean

CC      ?= cc
CFLAGS  ?= -O2 -Wall -Wextra -std=c99 -pedantic
TARGET  := kraken
SRC     := kraken.c

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $@ $<

run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(TARGET)

.PHONY: run clean
