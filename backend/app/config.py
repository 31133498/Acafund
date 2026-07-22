from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AcaFund"
    env: str = "development"

    secret_key: str
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    database_url: str

    monnify_api_key: str = ""
    monnify_secret_key: str = ""
    monnify_contract_code: str = "3412200072"
    monnify_base_url: str = "https://sandbox.monnify.com"

    anthropic_api_key: str = ""
    nvidia_api_key: str = ""

    frontend_origin: str = "http://localhost:3000"
    expense_approval_threshold: float = 50000


settings = Settings()
