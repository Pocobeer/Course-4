#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <time.h>
#include <pthread.h>

#define CAPACITY 3          // кабинки
#define STREAK_LIMIT 5      
#define TOTAL_STUDENTS 20      

#define MIN_WASH_TIME 1     
#define MAX_WASH_TIME 5     

typedef enum { MALE = 0, FEMALE = 1 } gender_t;
#define GENDER_NAME(g) ((g) == MALE ? "мужчина" : "женщина")

typedef enum { EMPTY, MEN_INSIDE, WOMEN_INSIDE } bath_state_t;

typedef struct {
    pthread_mutex_t mutex;
    pthread_mutex_t mutex_inner;
    pthread_cond_t cond;

    int capacity;               
    int occupied;               
    bath_state_t bath_gender;    // кто внутри 

    int streak_gender;          
    int streak_used;             
    int streak_limit;            

    int remaining_male;
    int remaining_female;

    // Статистика 
    long total_wait_time;     
    long total_bath_time;      
    int entered_count;          
    int male_entered, female_entered;

    int verbose;
} bath_t;

void print_status(bath_t *b, const char *event, int id, gender_t g) {
    if (!b->verbose) return;
    printf("%s: студент %d (%s), занято %d/%d, внутри %s, стрик: %s %d/%d, осталось: M=%d, Ж=%d\n",
           event, id, GENDER_NAME(g),
           b->occupied, b->capacity,
           (b->bath_gender == EMPTY ? "пусто" :
            (b->bath_gender == MEN_INSIDE ? "мужчины" : "женщины")),
           (b->streak_gender == -1 ? "не определён" : GENDER_NAME(b->streak_gender)),
           b->streak_used, b->streak_limit,
           b->remaining_male, b->remaining_female);
}

void bath_init(bath_t *b, int cap, int streak_limit) {
    // Инициализация атрибутов для межпроцессной синхронизации
    pthread_mutexattr_t mattr;
    pthread_mutexattr_init(&mattr);
    pthread_mutexattr_setpshared(&mattr, PTHREAD_PROCESS_SHARED);
    
    pthread_condattr_t cattr;
    pthread_condattr_init(&cattr);
    pthread_condattr_setpshared(&cattr, PTHREAD_PROCESS_SHARED);
    
    // Инициализация мьютексов и условной переменной
    pthread_mutex_init(&b->mutex_inner, &mattr);
    pthread_mutex_init(&b->mutex, &mattr);
    pthread_cond_init(&b->cond, &cattr);
    
    // Очистка атрибутов
    pthread_mutexattr_destroy(&mattr);
    pthread_condattr_destroy(&cattr);
    
    // Инициализация данных
    b->capacity = cap;
    b->occupied = 0;
    b->bath_gender = EMPTY;
    b->streak_gender = -1;
    b->streak_used = 0;
    b->streak_limit = streak_limit;
    b->remaining_male = 0;
    b->remaining_female = 0;
    b->total_wait_time = 0;
    b->total_bath_time = 0;
    b->entered_count = 0;
    b->male_entered = 0;
    b->female_entered = 0;
    b->verbose = 1;
}

void student_process(int id, bath_t *bath) {
    gender_t gender = (rand() % 100 < 50) ? MALE : FEMALE;
    int wash_time = MIN_WASH_TIME + rand() % (MAX_WASH_TIME - MIN_WASH_TIME + 1);
    
    time_t wait_start = time(NULL);

    // ЛОГИКА ВХОДА В ВАННУ
    pthread_mutex_lock(&bath->mutex);
    
    if (gender == MALE) bath->remaining_male++; else bath->remaining_female++;
    
    while (1) {
        int can_enter = 0;
        
        pthread_mutex_lock(&bath->mutex_inner);
        // Проверка вместимости
        if (bath->occupied >= bath->capacity) {
            can_enter = 0;
        } 
        // Пустая ванная
        else if (bath->occupied == 0) {
            if (bath->streak_gender == -1) {
                can_enter = 1; // Любой пол разрешён
            } else {
                int allowed = (bath->streak_used < bath->streak_limit) ? 
                              bath->streak_gender : !bath->streak_gender;
                if (gender == allowed) {
                    can_enter = 1;
                } else {
                    // Сброс стрика, если нужного пола нет
                    if ((allowed == MALE && bath->remaining_male == 0) || 
                        (allowed == FEMALE && bath->remaining_female == 0)) {
                        bath->streak_gender = -1;
                        bath->streak_used = 0;
                        can_enter = 1;
                    }
                }
            }
        } 
        // Ванная занята
        else {
            if ((bath->bath_gender == MEN_INSIDE && gender != MALE) ||
                (bath->bath_gender == WOMEN_INSIDE && gender != FEMALE)) {
                can_enter = 0; // Только тот же пол
            } else {
                int allowed = (bath->streak_used < bath->streak_limit) ? 
                              bath->streak_gender : !bath->streak_gender;
                can_enter = (gender == allowed);
            }
        }
        pthread_mutex_unlock(&bath->mutex_inner);

        if (can_enter) break;
        pthread_cond_wait(&bath->cond, &bath->mutex);
    }

    // Обновление статистики ожидания
    time_t now = time(NULL);
    bath->total_wait_time += (now - wait_start);

    // Вход в ванную
    bath->occupied++;
    if (bath->occupied == 1) {
        bath->bath_gender = (gender == MALE) ? MEN_INSIDE : WOMEN_INSIDE;
    }
    // Уменьшаем счетчик ожидающих студентов
    if (gender == MALE) bath->remaining_male--; else bath->remaining_female--;

    // Обновление стрика
    if (bath->streak_gender == -1) {
        bath->streak_gender = gender;
        bath->streak_used = 1;
    } else if (gender == bath->streak_gender) {
        bath->streak_used++;
    } else {
        bath->streak_gender = gender;
        bath->streak_used = 1;
    }

    print_status(bath, "ВХОД", id, gender);
    pthread_mutex_unlock(&bath->mutex);
    //КОНЕЦ ЛОГИКИ ВХОДА

    time_t bath_start = time(NULL);
    sleep(wash_time);
    long bath_sec = time(NULL) - bath_start;
    //КОНЕЦ ПРЕБЫВАНИЯ 

    //ЛОГИКА ВЫХОДА ИЗ ВАННЫ
    pthread_mutex_lock(&bath->mutex);
    bath->occupied--;
    bath->total_bath_time += bath_sec;
    bath->entered_count++;
    if (gender == MALE) bath->male_entered++; else bath->female_entered++;

    if (bath->occupied == 0) {
        bath->bath_gender = EMPTY;
    }

    print_status(bath, "ВЫХОД", id, gender);
    pthread_cond_broadcast(&bath->cond);
    pthread_mutex_unlock(&bath->mutex);
    //КОНЕЦ ЛОГИКИ ВЫХОДА
}

int main() {
    // Удаляем предыдущую разделяемую память, если существует
    shm_unlink("/bath_shm");

    // Создаем сегмент разделяемой памяти
    int shm_fd = shm_open("/bath_shm", O_CREAT | O_RDWR, 0666);
    if (shm_fd == -1) {
        perror("shm_open");
        exit(1);
    }
    
    // Устанавливаем размер сегмента
    if (ftruncate(shm_fd, sizeof(bath_t)) == -1) {
        perror("ftruncate");
        exit(1);
    }
    
    // Отображаем сегмент в адресное пространство
    bath_t *bath = mmap(0, sizeof(bath_t), PROT_READ | PROT_WRITE, MAP_SHARED, shm_fd, 0);
    if (bath == MAP_FAILED) {
        perror("mmap");
        exit(1);
    }
    
    // Инициализируем структуру в разделяемой памяти
    bath_init(bath, CAPACITY, STREAK_LIMIT);

    // Создаем процессы-студенты
    for (int i = 0; i < TOTAL_STUDENTS; i++) {
        pid_t pid = fork();
        if (pid == 0) {
            // Дочерний процесс
            srand(time(NULL) ^ getpid()); // Уникальная последовательность для каждого процесса
            student_process(i, bath);
            exit(0);
        } else if (pid < 0) {
            perror("fork");
            exit(1);
        }
        usleep(100000); // Задержка между запуском процессов
    }

    // Родительский процесс ждет завершения всех дочерних
    for (int i = 0; i < TOTAL_STUDENTS; i++) {
        wait(NULL);
    }

    // Вывод статистики
    printf("\nСТАТИСТИКА\n");
    printf("Всего студентов: %d\n", TOTAL_STUDENTS);
    printf("Мужчин вошло: %d, женщин: %d\n", bath->male_entered, bath->female_entered);
    double avg_wait = (bath->entered_count > 0) ?
        (double)bath->total_wait_time / bath->entered_count : 0;
    double avg_bath = (bath->entered_count > 0) ?
        (double)bath->total_bath_time / bath->entered_count : 0;
    printf("Среднее время ожидания: %.3f сек\n", avg_wait);
    printf("Среднее время в ванной: %.3f сек\n", avg_bath);

    // Уничтожение синхронизационных объектов
    pthread_mutex_destroy(&bath->mutex);
    pthread_mutex_destroy(&bath->mutex_inner);
    pthread_cond_destroy(&bath->cond);

    // Освобождение ресурсов
    munmap(bath, sizeof(bath_t));
    shm_unlink("/bath_shm");

    return 0;
}