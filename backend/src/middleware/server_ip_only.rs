use actix_web::{
    Error,
    body::EitherBody,
    dev::{Service, ServiceRequest, ServiceResponse, Transform, forward_ready},
};
use futures_util::future::LocalBoxFuture;
use std::{
    future::{Ready, ready},
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
};

use crate::models::responses::ApiResponse;

pub struct LocalOnly;

impl<S, B> Transform<S, ServiceRequest> for LocalOnly
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = LocalOnlyMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(LocalOnlyMiddleware { service }))
    }
}

pub struct LocalOnlyMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for LocalOnlyMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let peer_opt = req.peer_addr();

        fn denied_response<B>(req: ServiceRequest) -> ServiceResponse<EitherBody<B>> {
            let http_response = ApiResponse::<()>::builder()
                .message("You can access to this endpoint only from the server")
                .forbidden();
            let resp = http_response.map_into_right_body();
            req.into_response(resp)
        }

        if let Some(socket_addr) = peer_opt {
            let ip = socket_addr.ip();
            let allowed =
                ip == IpAddr::V4(Ipv4Addr::LOCALHOST) || ip == IpAddr::V6(Ipv6Addr::LOCALHOST);

            if allowed {
                let fut = self.service.call(req);
                Box::pin(async move {
                    let res = fut.await?;
                    Ok(res.map_into_left_body())
                })
            } else {
                Box::pin(async move { Ok(denied_response(req)) })
            }
        } else {
            Box::pin(async move { Ok(denied_response(req)) })
        }
    }
}
