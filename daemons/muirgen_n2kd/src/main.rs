use sqlx::postgres::PgPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    // Load the .env DB access file
    dotenvy::dotenv().ok();

    // Pull the DATABASE_RULE out of the .env file
    let db_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be defined in the .env file.");

    println!("Accessing central database...");

    // Connect using the URL from the .env file.
    let pool = match PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
    {
        Ok(p) => p, 
        Err(e) => {
            eprintln!("Access Failure! Error: [{}]", e);
            std::process::exit(1);
        }
    };
    
        println!("Access granted. Verifying...");

        let row: (i32,) = sqlx::query_as("SELECT 1;")
            .fetch_one(&pool)
            .await?;
        
        println!("Validated. Test responce: [{}]", row.0);

        Ok(())
}